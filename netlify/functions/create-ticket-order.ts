import { Handler } from '@netlify/functions';

// PayPal API endpoints
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface CreateTicketOrderRequest {
  orderId: string;
  teamId: string;
  eventId: string;
  ticketConfigId: string;
  buyerEmail: string;
  buyerName: string;
  items: {
    tierId?: string;
    tierName?: string;
    quantity: number;
    priceEach: number;
  }[];
  subtotal: number;
  processingFee: number;
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
    const body: CreateTicketOrderRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!body.orderId || !body.eventId || !body.items?.length) {
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

    // Calculate ticket count
    const ticketCount = body.items.reduce((sum, item) => sum + item.quantity, 0);

    // Build line items for PayPal
    const items = body.items.map(item => ({
      name: item.tierName || 'Event Ticket',
      unit_amount: {
        currency_code: 'USD',
        value: (item.priceEach / 100).toFixed(2),
      },
      quantity: item.quantity.toString(),
      description: `${item.quantity}x ticket(s)`,
      category: 'DIGITAL_GOODS',
    }));

    // Add processing fee as separate line item
    if (body.processingFee > 0) {
      items.push({
        name: 'Processing Fee',
        unit_amount: {
          currency_code: 'USD',
          value: (body.processingFee / 100).toFixed(2),
        },
        quantity: '1',
        description: 'Platform processing fee',
        category: 'DIGITAL_GOODS',
      });
    }

    // Calculate totals
    const itemTotal = ((body.subtotal + body.processingFee) / 100).toFixed(2);
    const orderTotal = (body.grandTotal / 100).toFixed(2);

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `ticket_${body.orderId}_${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: body.orderId,
            description: `${ticketCount} Event Ticket${ticketCount > 1 ? 's' : ''} - OSYS`,
            custom_id: JSON.stringify({
              orderId: body.orderId,
              eventId: body.eventId,
              type: 'ticket'
            }),
            amount: {
              currency_code: 'USD',
              value: orderTotal,
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: itemTotal,
                },
              },
            },
            items,
          },
        ],
        application_context: {
          brand_name: 'OSYS',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.URL || 'https://osys.team'}/tickets/success`,
          cancel_url: `${process.env.URL || 'https://osys.team'}/tickets/cancel`,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('PayPal order creation error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: errorData.details?.[0]?.description || 'Failed to create PayPal order' 
        }),
      };
    }

    const orderData = await orderResponse.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        paypalOrderId: orderData.id,
        orderId: body.orderId,
      }),
    };
  } catch (error) {
    console.error('Create ticket order error:', error);
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
