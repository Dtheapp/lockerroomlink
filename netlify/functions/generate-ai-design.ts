import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface GenerateDesignRequest {
  prompt: string;
  width: number;
  height: number;
  designType: string;
  style: string;
  mood: string;
  numVariations?: number;
}

interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Verify authorization
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const body: GenerateDesignRequest = JSON.parse(event.body || '{}');
    const { prompt, width, height, designType, style, mood } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Prompt is required' }),
      };
    }

    // Get OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'AI service not configured',
          details: 'OpenAI API key not configured.',
        }),
      };
    }

    // Enhance prompt for DALL-E based on design type
    const enhancedPrompt = buildEnhancedPrompt(prompt, designType, style, mood);
    
    // Determine optimal size for DALL-E 3 (it only supports specific sizes)
    const dalleSize = getDalleSize(width, height);

    console.log('Generating AI design:', {
      prompt: prompt.substring(0, 100),
      dalleSize,
    });

    // Generate ONLY 1 image to stay within timeout
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: dalleSize,
        quality: 'standard',
        response_format: 'url',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('DALL-E API error:', errorData);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'AI generation failed',
          details: errorData.substring(0, 200),
        }),
      };
    }

    const data = await response.json();
    const imageData = data.data?.[0];

    if (!imageData?.url) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'No image generated',
          details: 'DALL-E returned empty response',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        images: [{
          url: imageData.url,
          revisedPrompt: imageData.revised_prompt,
        }],
        dalleSize,
      }),
    };

  } catch (error) {
    console.error('Generate AI design error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Build an enhanced prompt optimized for DALL-E 3
 */
function buildEnhancedPrompt(
  userPrompt: string, 
  designType: string, 
  style: string, 
  mood: string
): string {
  const typeHints: Record<string, string> = {
    'logo': 'professional sports team logo design, vector-style, clean edges, suitable for merchandise and branding, centered composition on solid or transparent background',
    'registration-flyer': 'sports registration flyer design, eye-catching promotional material, clear call to action, modern layout',
    'event-poster': 'sports event poster, dynamic and exciting, promotional graphic design with strong visual hierarchy',
    'social-post': 'social media graphic for sports team, Instagram-ready square design, engaging and shareable',
    'player-spotlight': 'athlete spotlight graphic, celebratory sports design highlighting player achievement',
    'announcement': 'sports team announcement graphic, clean and professional, news bulletin style',
    'celebration': 'victory celebration graphic for sports team, triumphant and energetic design',
  };

  const styleHints: Record<string, string> = {
    'modern': 'clean modern design, minimalist aesthetic, contemporary typography',
    'vintage': 'retro vintage style, classic sports aesthetic, nostalgic feel',
    'playful': 'fun and playful design, vibrant and youthful',
    'bold': 'bold aggressive design, strong impactful visuals, high contrast',
    'minimal': 'minimalist design, simple and elegant, whitespace focused',
    'grunge': 'grungy textured style, distressed look, urban feel',
    'elegant': 'elegant sophisticated design, refined and classy',
  };

  const moodHints: Record<string, string> = {
    'energetic': 'high energy dynamic feel',
    'professional': 'professional polished look',
    'fun': 'fun lighthearted atmosphere',
    'intense': 'intense fierce competitive energy',
    'celebratory': 'celebratory triumphant mood',
  };

  const parts: string[] = [];
  
  // Add the type context
  if (typeHints[designType]) {
    parts.push(typeHints[designType]);
  }
  
  // Add the user's actual description (most important)
  parts.push(userPrompt);
  
  // Add style hints
  if (styleHints[style]) {
    parts.push(styleHints[style]);
  }
  
  // Add mood hints
  if (moodHints[mood]) {
    parts.push(moodHints[mood]);
  }
  
  // Add quality hints for DALL-E 3
  parts.push('High quality professional graphic design, suitable for print and digital use');
  
  return parts.join('. ');
}

/**
 * Get variation hints to make each generation different
 */
function getVariationHint(index: number, style: string): string {
  const hints = [
    '', // First is base
    'different layout and composition, alternative color arrangement',
    'unique artistic interpretation, creative variation',
  ];
  return hints[index] || '';
}

/**
 * Map requested size to nearest DALL-E 3 supported size
 * DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
 */
function getDalleSize(width: number, height: number): '1024x1024' | '1792x1024' | '1024x1792' {
  const aspectRatio = width / height;
  
  if (aspectRatio > 1.3) {
    // Wide/landscape
    return '1792x1024';
  } else if (aspectRatio < 0.77) {
    // Tall/portrait  
    return '1024x1792';
  } else {
    // Square-ish
    return '1024x1024';
  }
}

export { handler };
