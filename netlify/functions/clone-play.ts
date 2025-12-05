import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// Types for the clone play feature
interface ClonedPlayer {
  id: string;
  x: number;
  y: number;
  shape: 'circle' | 'triangle' | 'square' | 'x';
  detectedColor?: string;
  suggestedType?: 'O' | 'X';
  assignedPosition?: string;
  isAssigned: boolean;
}

interface ClonedRoute {
  id: string;
  points: { x: number; y: number }[];
  lineType: 'solid' | 'dashed' | 'curved' | 'zigzag';
  color: string;
  hasArrow: boolean;
}

interface ClonedShape {
  id: string;
  shapeType: 'circle' | 'oval' | 'rectangle' | 'square';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface ClonePlayAnalysis {
  players: ClonedPlayer[];
  routes: ClonedRoute[];
  shapes: ClonedShape[];
  suggestedCategory: 'Offense' | 'Defense' | 'Special Teams';
  confidence: number;
}

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { imageBase64, userId } = JSON.parse(event.body || '{}');

    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image provided' })
      };
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No user ID provided' })
      };
    }

    // Get OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your Netlify environment variables.' 
        })
      };
    }

    // Prepare the image for OpenAI - handle both data URLs and raw base64
    let imageData = imageBase64;
    if (!imageBase64.startsWith('data:')) {
      imageData = `data:image/png;base64,${imageBase64}`;
    }

    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a football play diagram analyzer. Analyze the image and extract:
1. Player positions - identify circles (usually offense) and triangles/X shapes (usually defense)
2. Routes/arrows - lines showing player movement paths
3. Zones/shapes - rectangles, ovals, or other areas

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "players": [
    {"x": 50, "y": 30, "shape": "circle", "suggestedType": "O", "detectedColor": "blue"},
    {"x": 45, "y": 60, "shape": "triangle", "suggestedType": "X", "detectedColor": "red"}
  ],
  "routes": [
    {"points": [{"x": 50, "y": 30}, {"x": 55, "y": 20}], "lineType": "solid", "color": "#FACC15", "hasArrow": true}
  ],
  "shapes": [
    {"shapeType": "oval", "x": 50, "y": 80, "width": 40, "height": 10, "color": "#ff0000"}
  ],
  "suggestedCategory": "Defense",
  "confidence": 85
}

COORDINATE SYSTEM:
- x: 0 = left edge, 100 = right edge
- y: 0 = top (end zone), 100 = bottom (other end zone)
- Place coordinates as percentage of field

SHAPE DETECTION:
- Circles = usually offensive players (O)
- Triangles, X marks = usually defensive players (X)
- Squares/rectangles with players inside = zones or special markers

LINE TYPES:
- Solid lines = movement routes
- Dashed lines = pass routes or optional movements  
- Curved lines = curved routes
- Zigzag = blocking or special routes

COLORS: Try to detect actual colors, default to #FACC15 (yellow) for routes if unclear.

Be thorough - detect ALL players and routes visible in the image.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this football play diagram. Extract all player positions, routes/arrows, and zones. Return the JSON response only.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.2
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to analyze image with AI',
          details: openaiResponse.status === 401 ? 'Invalid API key' : 'API request failed'
        })
      };
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No analysis returned from AI' })
      };
    }

    // Parse the AI response - handle potential JSON in markdown code blocks
    let analysis: ClonePlayAnalysis;
    try {
      // Remove markdown code blocks if present
      let jsonStr = aiContent.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);
      
      // Validate and add IDs to players
      analysis = {
        players: (parsed.players || []).map((p: any) => ({
          id: generateId(),
          x: Math.max(0, Math.min(100, Number(p.x) || 50)),
          y: Math.max(0, Math.min(100, Number(p.y) || 50)),
          shape: ['circle', 'triangle', 'square', 'x'].includes(p.shape) ? p.shape : 'circle',
          suggestedType: p.suggestedType === 'X' ? 'X' : 'O',
          detectedColor: p.detectedColor || '#3b82f6',
          isAssigned: false
        })),
        routes: (parsed.routes || []).map((r: any) => ({
          id: generateId(),
          points: (r.points || []).map((pt: any) => ({
            x: Math.max(0, Math.min(100, Number(pt.x) || 50)),
            y: Math.max(0, Math.min(100, Number(pt.y) || 50))
          })),
          lineType: ['solid', 'dashed', 'curved', 'zigzag'].includes(r.lineType) ? r.lineType : 'solid',
          color: r.color || '#FACC15',
          hasArrow: r.hasArrow !== false
        })),
        shapes: (parsed.shapes || []).map((s: any) => ({
          id: generateId(),
          shapeType: ['circle', 'oval', 'rectangle', 'square'].includes(s.shapeType) ? s.shapeType : 'rectangle',
          x: Math.max(0, Math.min(100, Number(s.x) || 50)),
          y: Math.max(0, Math.min(100, Number(s.y) || 50)),
          width: Math.max(1, Math.min(50, Number(s.width) || 10)),
          height: Math.max(1, Math.min(50, Number(s.height) || 10)),
          color: s.color || '#ff0000'
        })),
        suggestedCategory: ['Offense', 'Defense', 'Special Teams'].includes(parsed.suggestedCategory) 
          ? parsed.suggestedCategory 
          : 'Offense',
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 70))
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to parse AI analysis',
          rawResponse: aiContent.substring(0, 500)
        })
      };
    }

    // Return the analysis
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis
      })
    };

  } catch (error) {
    console.error('Clone play error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
