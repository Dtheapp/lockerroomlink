import { Handler } from '@netlify/functions';

// =============================================================================
// CREATE CREDIT ORDER - Server-side PayPal order creation for credit purchases
// =============================================================================

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface CreateCreditOrderRequest {
  userId: string;
  bundleId: string;
  bundleName: string;
  credits: number;
  bonusCredits: number;
  price: number;        // Price in cents (e.g., 999 = $9.99)
  currency?: string;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: CreateCreditOrderRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!body.userId || !body.bundleId || !body.credits || !body.price) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: userId, bundleId, credits, price' }),
      };
    }

    // Validate price is positive and reasonable
    if (body.price <= 0 || body.price > 100000) { // Max $1000
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid price amount' }),
      };
    }

    // Validate credits match expected bundle
    if (body.credits <= 0 || body.credits > 10000) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credits amount' }),
      };
    }

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Convert cents to dollars
    const priceInDollars = (body.price / 100).toFixed(2);
    const totalCredits = body.credits + (body.bonusCredits || 0);
    const currency = body.currency || 'USD';

    // Create order with PayPal
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: `credits_${body.userId}_${Date.now()}`,
        description: `${totalCredits} OSYS Credits - ${body.bundleName}`,
        custom_id: JSON.stringify({
          type: 'credit_purchase',
          userId: body.userId,
          bundleId: body.bundleId,
          credits: body.credits,
          bonusCredits: body.bonusCredits || 0,
        }),
        amount: {
          currency_code: currency,
          value: priceInDollars,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: priceInDollars,
            },
          },
        },
        items: [{
          name: `${body.bundleName} Credit Bundle`,
          unit_amount: {
            currency_code: currency,
            value: priceInDollars,
          },
          quantity: '1',
          description: `${body.credits} credits${body.bonusCredits ? ` + ${body.bonusCredits} bonus` : ''}`,
          category: 'DIGITAL_GOODS',
        }],
      }],
      application_context: {
        brand_name: 'OSYS',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.URL || 'https://osys.app'}/credits/success`,
        cancel_url: `${process.env.URL || 'https://osys.app'}/credits/cancel`,
      },
    };

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `credit_order_${body.userId}_${Date.now()}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal create order error:', errorData);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: errorData.details?.[0]?.description || 'Failed to create PayPal order' 
        }),
      };
    }

    const orderData = await response.json();
    
    // Find the approval URL for redirect
    const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        orderId: orderData.id,
        approvalUrl,
        status: orderData.status,
      }),
    };
  } catch (error) {
    console.error('Create credit order error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
};

export { handler };
