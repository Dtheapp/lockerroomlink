import { Handler } from '@netlify/functions';

// PayPal API endpoints
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface CaptureTicketOrderRequest {
  orderId: string;
  paypalOrderId: string;
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
    const body: CaptureTicketOrderRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!body.orderId || !body.paypalOrderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Capture the order
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${body.paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `capture_ticket_${body.paypalOrderId}_${Date.now()}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal capture error:', errorData);
      
      // Handle already captured
      if (errorData.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            status: 'ALREADY_CAPTURED',
            message: 'Payment was already processed',
          }),
        };
      }
      
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: errorData.details?.[0]?.description || 'Failed to capture payment' 
        }),
      };
    }

    const captureData = await response.json();
    
    // Extract transaction ID
    const captures = captureData.purchase_units?.[0]?.payments?.captures;
    const transactionId = captures?.[0]?.id;

    // Get buyer info from PayPal response
    const payer = captureData.payer;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        transactionId,
        status: captureData.status,
        payerEmail: payer?.email_address,
        payerName: payer?.name ? `${payer.name.given_name} ${payer.name.surname}` : undefined,
      }),
    };
  } catch (error) {
    console.error('Capture ticket order error:', error);
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
