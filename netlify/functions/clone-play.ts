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

CRITICAL: EXPECT 22 PLAYERS (11 offense + 11 defense) in most diagrams!

PLAYER SYMBOL IDENTIFICATION:
1. CIRCLES (filled or hollow, any color) = Offensive players → type: "O", shape: "circle"
2. SMALL SQUARES (same size as circles, on the offensive line) = Offensive players (usually center) → type: "O", shape: "circle" (treat as circle!)
3. TRIANGLES (filled or hollow, pointing any direction) = Defensive players → type: "X", shape: "triangle"
4. X marks = Defensive players → type: "X", shape: "x"

CRITICAL - DISTINGUISHING PLAYERS FROM DECORATIONS:
- LARGE RECTANGLES that CONTAIN other players inside them = Visual groupings/boxes, NOT players! (e.g., boxes around cornerbacks)
- LARGE OVALS at bottom of field = Zone markers, NOT players!
- SMALL circles/squares/triangles that are SIMILAR SIZE to other player symbols = ACTUAL PLAYERS
- If a rectangle contains a circle AND a triangle, count BOTH the circle AND triangle as separate players, ignore the rectangle

SIZE RULE: If a shape is 3-5x larger than the typical player symbols, it's a decoration. If it's similar size, it's a player.

COORDINATE MAPPING:
- x: 0 = left edge, 100 = right edge of the PLAY AREA (not the whole image)
- y: 0 = top of play area, 100 = bottom
- Ignore title bars, slide numbers, decorative borders
- Map players to fill roughly 10-90 range for x and 15-85 range for y

TYPICAL LAYOUT for 4-4 Defense vs Offense:
Row 1 (y~10-15): 2 safeties (circles, O)
Row 2 (y~25-30): 4-5 secondary/receivers (circles, O) - may include players in boxes on the sides
Row 3 (y~35-45): 4 linebackers (triangles, X)
Row 4 (y~50-60): 4 D-linemen (triangles, X)
Row 5 (y~65-75): 5-7 offensive linemen (circles + 1 small square for center, all count as O)
Row 6 (y~80-90): Deep safety in oval zone (triangle, X) - count the triangle, ignore the oval

Return ONLY valid JSON:
{
  "players": [
    {"x": 50, "y": 70, "shape": "circle", "suggestedType": "O"},
    {"x": 50, "y": 50, "shape": "triangle", "suggestedType": "X"}
  ],
  "routes": [
    {"points": [{"x": 30, "y": 45}, {"x": 35, "y": 35}], "lineType": "solid", "color": "#FACC15", "hasArrow": true}
  ],
  "shapes": [],
  "suggestedCategory": "Defense",
  "confidence": 90,
  "totalPlayersDetected": 22
}

ROUTES/ARROWS:
- Solid arrows = "solid", Dashed arrows = "dashed", Curved = "curved"
- Yellow=#FACC15, Red=#ef4444, White=#ffffff

DO NOT output large rectangles or ovals as shapes - they are field decorations.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this football play diagram. This likely has 22 PLAYERS (11 offense + 11 defense). Count EVERY circle (offense), small square (offense), and triangle (defense). Large rectangles around players are just visual groupings - count the players INSIDE them. Return JSON only.'
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
