import { Handler } from '@netlify/functions';

// PayPal API endpoints
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface CreateDonationOrderRequest {
  campaignId: string;
  campaignTitle: string;
  recipientPaypalEmail: string;
  amount: string; // In dollars
  platformTip?: string; // Optional tip to OSYS
  donorName: string;
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
    const body: CreateDonationOrderRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!body.campaignId || !body.recipientPaypalEmail || !body.amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const donationAmount = parseFloat(body.amount);
    if (isNaN(donationAmount) || donationAmount < 1) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid donation amount' }),
      };
    }

    const platformTip = parseFloat(body.platformTip || '0') || 0;
    const totalAmount = donationAmount + platformTip;

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Build PayPal order
    // This creates a payment that goes directly to the recipient's PayPal email
    const purchaseUnits: any[] = [
      {
        reference_id: body.campaignId,
        description: `Donation: ${body.campaignTitle}`,
        custom_id: body.campaignId,
        amount: {
          currency_code: 'USD',
          value: donationAmount.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: donationAmount.toFixed(2),
            },
          },
        },
        items: [
          {
            name: `Donation to ${body.campaignTitle.substring(0, 100)}`,
            unit_amount: {
              currency_code: 'USD',
              value: donationAmount.toFixed(2),
            },
            quantity: '1',
            description: `From ${body.donorName}`,
            category: 'DONATION', // PayPal donation category
          },
        ],
        // Send payment directly to recipient
        payee: {
          email_address: body.recipientPaypalEmail,
        },
      },
    ];

    // If there's a platform tip, add a second purchase unit for OSYS
    if (platformTip > 0 && process.env.OSYS_PAYPAL_EMAIL) {
      purchaseUnits.push({
        reference_id: `tip-${body.campaignId}`,
        description: 'Platform Support Tip',
        amount: {
          currency_code: 'USD',
          value: platformTip.toFixed(2),
        },
        items: [
          {
            name: 'OSYS Platform Tip',
            unit_amount: {
              currency_code: 'USD',
              value: platformTip.toFixed(2),
            },
            quantity: '1',
            description: 'Thank you for supporting OSYS!',
            category: 'DONATION',
          },
        ],
        payee: {
          email_address: process.env.OSYS_PAYPAL_EMAIL,
        },
      });
    }

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `donation-${body.campaignId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: purchaseUnits,
        application_context: {
          brand_name: 'OSYS Fundraising',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.URL || 'https://osys.app'}/fundraising/success`,
          cancel_url: `${process.env.URL || 'https://osys.app'}/fundraising/cancel`,
        },
      }),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.json();
      console.error('PayPal create order error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed to create PayPal order',
          details: error.details?.[0]?.description || error.message
        }),
      };
    }

    const orderData = await orderResponse.json();

    console.log(`✅ Donation order created: ${orderData.id} for campaign ${body.campaignId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        orderId: orderData.id,
        paypalOrderId: orderData.id,
        status: orderData.status,
      }),
    };
  } catch (error) {
    console.error('Create donation order error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
    };
  }
};

export { handler };
