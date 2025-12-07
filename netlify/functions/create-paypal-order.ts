import { Handler } from '@netlify/functions';

// PayPal API endpoints
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface CreateOrderRequest {
  eventId: string;
  teamId: string;
  items: {
    athleteId: string;
    athleteName: string;
    tierId: string;
    tierName: string;
    price: number;
  }[];
  promoCode?: string;
  promoDiscount: number;
  subtotal: number;
  grandTotal: number;
}

// Get PayPal access token
async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal auth error:', error);
    throw new Error('Failed to authenticate with PayPal');
  }

  const data = await response.json();
  return data.access_token;
}

const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: CreateOrderRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!body.eventId || !body.teamId || !body.items?.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    if (body.grandTotal <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid order amount' }),
      };
    }

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Build line items for PayPal
    const items = body.items.map(item => ({
      name: `${item.athleteName} - ${item.tierName}`,
      unit_amount: {
        currency_code: 'USD',
        value: (item.price / 100).toFixed(2),
      },
      quantity: '1',
      description: `Registration for ${item.athleteName}`,
      category: 'DIGITAL_GOODS', // For service payments
    }));

    // Calculate totals
    const itemTotal = (body.subtotal / 100).toFixed(2);
    const discount = (body.promoDiscount / 100).toFixed(2);
    const orderTotal = (body.grandTotal / 100).toFixed(2);

    // Create order with PayPal
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: `${body.eventId}_${Date.now()}`,
        description: `Event Registration`,
        custom_id: JSON.stringify({
          eventId: body.eventId,
          teamId: body.teamId,
          promoCode: body.promoCode,
        }),
        amount: {
          currency_code: 'USD',
          value: orderTotal,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: itemTotal,
            },
            ...(body.promoDiscount > 0 && {
              discount: {
                currency_code: 'USD',
                value: discount,
              },
            }),
          },
        },
        items,
      }],
      application_context: {
        brand_name: 'LockerRoomLink',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.URL}/registration/success`,
        cancel_url: `${process.env.URL}/registration/cancel`,
      },
    };

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `order_${body.eventId}_${Date.now()}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal create order error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: errorData.details?.[0]?.description || 'Failed to create PayPal order' 
        }),
      };
    }

    const orderData = await response.json();

    // Generate internal order ID for tracking
    const internalOrderId = `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        orderId: internalOrderId,
        paypalOrderId: orderData.id,
      }),
    };
  } catch (error) {
    console.error('Create order error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
};

export { handler };
