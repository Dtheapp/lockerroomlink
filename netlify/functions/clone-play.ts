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
            content: `You are an expert football play diagram analyzer. Your task is to PRECISELY identify every player and visual element.

CRITICAL EXPECTATIONS:
- Football plays have exactly 22 PLAYERS: 11 offense + 11 defense
- You MUST find and output ALL 22 players!

STEP 1 - IDENTIFY ALL PLAYER SHAPES:
Count each symbol ONCE, even if inside a rectangle/box:

OFFENSIVE PLAYERS (11 total) - output as suggestedType: "O":
- CIRCLES (solid red/any color) = use shape: "circle"
- SMALL SQUARES on the line (same size as circles) = use shape: "circle" (the center position)

DEFENSIVE PLAYERS (11 total) - output as suggestedType: "X":  
- TRIANGLES (solid red, pointing up/down) = use shape: "triangle" ← KEEP AS TRIANGLES!
- X marks = use shape: "x"

STEP 2 - CRITICAL RULES:
1. RECTANGLES/BOXES with players INSIDE: Count the players INSIDE (circles, triangles), IGNORE the rectangle itself
2. Example: Green box with 1 circle and 1 triangle inside = output 2 players (1 circle O, 1 triangle X)
3. LARGE OVALS at field bottom = zone markers, but if there's a TRIANGLE inside/near it, count that triangle!
4. Small square same size as circles on offensive line = CENTER position, treat as circle type O

STEP 3 - COORDINATE MAPPING (VERY IMPORTANT):
Look at the ACTUAL x,y position of each player in the image and preserve their RELATIVE positions!
- x: 0=left edge, 100=right edge of play diagram area
- y: 0=top (where offense is deeper), 100=bottom (where defense secondary is)
- Spread players appropriately - if they're spaced out, reflect that spacing

TYPICAL 4-4 DEFENSE LAYOUT (from top to bottom of image):
- y≈15-20: 3 wide receivers/backs (circles, far apart horizontally)
- y≈25-35: 2-4 more offensive players (circles)
- y≈40-50: Offensive LINE - 5-6 circles + 1 small square (center). These should be CLOSE together horizontally!
- y≈55-65: Defensive LINE - 4 triangles (spread across)
- y≈65-75: Linebackers - 4 triangles (spread across)
- y≈80-90: Safety - 1 triangle (often in oval zone area)

STEP 4 - ROUTES AND LINES:
Detect arrow/route lines drawn from players:
- Yellow lines with arrows = routes
- Output start and end points of each route segment

STEP 5 - OUTPUT FORMAT (JSON only):
{
  "players": [
    {"x": 50, "y": 45, "shape": "circle", "suggestedType": "O"},
    {"x": 50, "y": 60, "shape": "triangle", "suggestedType": "X"}
  ],
  "routes": [
    {"points": [{"x": 50, "y": 45}, {"x": 55, "y": 30}], "lineType": "solid", "color": "#FACC15", "hasArrow": true}
  ],
  "shapes": [],
  "suggestedCategory": "Defense",
  "confidence": 85,
  "totalPlayersDetected": 22
}

SHAPE MUST BE: "circle", "triangle", or "x" - preserve the actual shape you see!
DO NOT convert triangles to circles!`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this football play diagram carefully:

1. COUNT ALL 22 PLAYERS - Look for 11 circles/squares (offense) and 11 triangles (defense)
2. Players inside rectangles/boxes still count - extract the circle or triangle inside!
3. The small square on the offensive line = center, treat as circle with type O
4. KEEP TRIANGLES AS TRIANGULAR SHAPE - don't convert to circles!
5. Preserve exact x,y positions - if players are spread wide, show them spread wide
6. Look for route lines (yellow arrows) and include them
7. Return ONLY valid JSON, no explanation text`
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
      
      // Process players - preserve relative positions better
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
      
      // Only normalize if the range is very narrow (all players bunched up)
      // Otherwise, trust the AI's coordinates more
      const xRange = maxX - minX || 1;
      const yRange = maxY - minY || 1;
      const shouldNormalizeX = xRange < 40; // Only normalize if spread is less than 40%
      const shouldNormalizeY = yRange < 40;
      
      const normalizeX = (x: number) => {
        if (shouldNormalizeX) {
          // Expand to use more of the field
          return 15 + ((x - minX) / xRange) * 70; // Map to 15-85
        }
        // Keep original but ensure within bounds
        return Math.max(8, Math.min(92, x));
      };
      
      const normalizeY = (y: number) => {
        if (shouldNormalizeY) {
          return 15 + ((y - minY) / yRange) * 70; // Map to 15-85
        }
        return Math.max(8, Math.min(92, y));
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
