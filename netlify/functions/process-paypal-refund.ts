import { Handler } from '@netlify/functions';

// PayPal API endpoints
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface RefundRequest {
  orderId: string;        // Our internal order ID
  transactionId: string;  // PayPal capture/transaction ID
  amount?: number;        // Amount in cents, omit for full refund
  reason?: string;
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
    const body: RefundRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!body.orderId || !body.transactionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Build refund payload
    const refundPayload: Record<string, unknown> = {};
    
    if (body.amount && body.amount > 0) {
      // Partial refund
      refundPayload.amount = {
        currency_code: 'USD',
        value: (body.amount / 100).toFixed(2),
      };
    }
    
    if (body.reason) {
      refundPayload.note_to_payer = body.reason;
    }

    // Process refund
    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/payments/captures/${body.transactionId}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `refund_${body.transactionId}_${Date.now()}`,
        },
        body: JSON.stringify(refundPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal refund error:', errorData);
      
      // Handle specific errors
      if (errorData.details?.[0]?.issue === 'CAPTURE_FULLY_REFUNDED') {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: 'This payment has already been fully refunded',
          }),
        };
      }
      
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: errorData.details?.[0]?.description || 'Failed to process refund' 
        }),
      };
    }

    const refundData = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        refundId: refundData.id,
        status: refundData.status,
        amount: refundData.amount?.value,
      }),
    };
  } catch (error) {
    console.error('Process refund error:', error);
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
