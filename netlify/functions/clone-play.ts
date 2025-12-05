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
  detectedPlayerCount: number;
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

    // Call OpenAI Vision API with improved prompt
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
            content: `You are an expert football play diagram analyzer. Your job is to PRECISELY detect and count EVERY player symbol in a football play diagram.

CRITICAL INSTRUCTIONS:
1. COUNT CAREFULLY - Football plays typically have 11 offensive players AND may show defensive players (11 more). Count EVERY circle and triangle symbol.
2. IGNORE decorative elements - Rectangles around groups of players are just visual groupings, NOT players. Large ovals/circles at bottom are zone markers, NOT players.
3. PRESERVE RELATIVE POSITIONS - The positions you output should maintain the EXACT same relative spacing as the original image.

PLAYER IDENTIFICATION:
- CIRCLES (filled or hollow) = Offensive players (type: "O")
- TRIANGLES (filled or hollow, pointing up or down) = Defensive players (type: "X")  
- SQUARES = Usually a special player like center or quarterback
- X marks = Defensive players

COORDINATE MAPPING (VERY IMPORTANT):
- Look at the ACTUAL playing area in the image (ignore title bars, decorations)
- Map the leftmost player to around x=10-15
- Map the rightmost player to around x=85-90
- Map the topmost player to around y=15-25
- Map the bottommost player to around y=75-85
- PRESERVE the relative distances between players exactly

For a typical 4-4 defense image like this:
- Back row (safeties): 2 circles at top = y around 10-15
- Second row (secondary): circles in a line = y around 25-30
- Third row (linebackers): triangles = y around 40-50
- Front row (D-line): triangles = y around 55-65
- Deep safety in oval: triangle = y around 80-85

Return ONLY valid JSON (no markdown, no explanation):
{
  "players": [
    {"x": 50, "y": 15, "shape": "circle", "suggestedType": "O"},
    {"x": 30, "y": 45, "shape": "triangle", "suggestedType": "X"}
  ],
  "routes": [
    {"points": [{"x": 30, "y": 45}, {"x": 35, "y": 35}], "lineType": "solid", "color": "#FACC15", "hasArrow": true}
  ],
  "shapes": [],
  "suggestedCategory": "Defense",
  "confidence": 90,
  "totalPlayersDetected": 18
}

ROUTES/ARROWS:
- Detect ALL arrow lines showing player movement
- "solid" = solid line, "dashed" = dashed line, "curved" = curved path
- Include the start point (at player) and end point (arrow tip)
- Color: yellow=#FACC15, red=#ef4444, white=#ffffff

DO NOT include large rectangles or ovals that are zone markers or field decorations - only include small shapes that represent specific coverage zones if they're clearly part of the play design.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this football play diagram. COUNT AND LIST EVERY SINGLE player symbol (circles AND triangles). There may be 15-22 total players. Extract all routes/arrows. Return JSON only.'
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
        max_tokens: 4000,
        temperature: 0.1
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
      
      // Process players and normalize coordinates to fit field view better
      const rawPlayers = parsed.players || [];
      
      // Calculate bounding box of detected players
      let minX = 100, maxX = 0, minY = 100, maxY = 0;
      rawPlayers.forEach((p: any) => {
        const px = Number(p.x) || 50;
        const py = Number(p.y) || 50;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      });
      
      // Normalize to use more of the field (15-85 range for x, 20-80 for y)
      const xRange = maxX - minX || 1;
      const yRange = maxY - minY || 1;
      
      const normalizeX = (x: number) => {
        if (xRange < 5) return 50; // If too compressed, center it
        return 15 + ((x - minX) / xRange) * 70; // Map to 15-85
      };
      
      const normalizeY = (y: number) => {
        if (yRange < 5) return 50;
        return 20 + ((y - minY) / yRange) * 60; // Map to 20-80
      };
      
      // Validate and add IDs to players
      analysis = {
        players: rawPlayers.map((p: any) => ({
          id: generateId(),
          x: Math.max(5, Math.min(95, normalizeX(Number(p.x) || 50))),
          y: Math.max(5, Math.min(95, normalizeY(Number(p.y) || 50))),
          shape: ['circle', 'triangle', 'square', 'x'].includes(p.shape) ? p.shape : 'circle',
          suggestedType: p.suggestedType === 'X' || p.shape === 'triangle' ? 'X' : 'O',
          detectedColor: p.detectedColor || (p.shape === 'triangle' ? '#ef4444' : '#3b82f6'),
          isAssigned: false
        })),
        routes: (parsed.routes || []).map((r: any) => ({
          id: generateId(),
          points: (r.points || []).map((pt: any) => ({
            x: Math.max(5, Math.min(95, normalizeX(Number(pt.x) || 50))),
            y: Math.max(5, Math.min(95, normalizeY(Number(pt.y) || 50)))
          })),
          lineType: ['solid', 'dashed', 'curved', 'zigzag'].includes(r.lineType) ? r.lineType : 'solid',
          color: r.color || '#FACC15',
          hasArrow: r.hasArrow !== false
        })),
        // Filter out large shapes that are likely field markers, not play elements
        shapes: (parsed.shapes || [])
          .filter((s: any) => {
            const width = Number(s.width) || 10;
            const height = Number(s.height) || 10;
            // Skip shapes that are too large (likely field decorations)
            return width < 30 && height < 30;
          })
          .map((s: any) => ({
            id: generateId(),
            shapeType: ['circle', 'oval', 'rectangle', 'square'].includes(s.shapeType) ? s.shapeType : 'rectangle',
            x: Math.max(5, Math.min(95, normalizeX(Number(s.x) || 50))),
            y: Math.max(5, Math.min(95, normalizeY(Number(s.y) || 50))),
            width: Math.max(1, Math.min(25, Number(s.width) || 10)),
            height: Math.max(1, Math.min(25, Number(s.height) || 10)),
            color: s.color || '#ff0000'
          })),
        suggestedCategory: ['Offense', 'Defense', 'Special Teams'].includes(parsed.suggestedCategory) 
          ? parsed.suggestedCategory 
          : 'Defense',
        confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 70)),
        detectedPlayerCount: rawPlayers.length
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
