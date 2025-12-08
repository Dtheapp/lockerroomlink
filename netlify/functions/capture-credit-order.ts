import { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';

// =============================================================================
// CAPTURE CREDIT ORDER - Verify PayPal payment and add credits SERVER-SIDE
// This is the SECURE way to add credits - only after payment verification
// =============================================================================

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;
    
  admin.initializeApp({
    credential: serviceAccount 
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'gridironhub-3131',
  });
}

const db = admin.firestore();

interface CaptureCreditOrderRequest {
  paypalOrderId: string;
  userId: string;
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
    throw new Error('Failed to authenticate with PayPal');
  }

  const data = await response.json();
  return data.access_token;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: CaptureCreditOrderRequest = JSON.parse(event.body || '{}');
    
    if (!body.paypalOrderId || !body.userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing paypalOrderId or userId' }),
      };
    }

    // Check if this order was already processed (idempotency)
    const existingPayment = await db.collection('paymentLogs')
      .where('paypalOrderId', '==', body.paypalOrderId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();
    
    if (!existingPayment.empty) {
      console.log('Order already processed:', body.paypalOrderId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          status: 'ALREADY_PROCESSED',
          message: 'This payment was already processed',
        }),
      };
    }

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Capture the PayPal order
    const captureResponse = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${body.paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `capture_credits_${body.paypalOrderId}_${Date.now()}`,
        },
      }
    );

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json();
      console.error('PayPal capture error:', errorData);
      
      // Handle already captured case
      if (errorData.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') {
        // Verify the order to get payment details
        const verifyResponse = await fetch(
          `${PAYPAL_API_BASE}/v2/checkout/orders/${body.paypalOrderId}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );
        if (verifyResponse.ok) {
          const orderData = await verifyResponse.json();
          if (orderData.status === 'COMPLETED') {
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: true,
                status: 'ALREADY_CAPTURED',
              }),
            };
          }
        }
      }
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: errorData.details?.[0]?.description || 'Payment capture failed' 
        }),
      };
    }

    const captureData = await captureResponse.json();
    
    // Extract payment info
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const transactionId = capture?.id;
    const status = capture?.status;
    
    if (status !== 'COMPLETED') {
      console.error('Payment not completed:', status);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Payment status: ${status}`,
        }),
      };
    }

    // Parse the custom data we embedded in the order
    let orderData: any = {};
    try {
      const customId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id 
        || captureData.purchase_units?.[0]?.custom_id;
      if (customId) {
        orderData = JSON.parse(customId);
      }
    } catch (e) {
      console.warn('Could not parse custom_id:', e);
    }

    // SECURITY: Verify the userId matches what was in the order
    if (orderData.userId && orderData.userId !== body.userId) {
      console.error('User ID mismatch! Order:', orderData.userId, 'Request:', body.userId);
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'User verification failed',
        }),
      };
    }

    const credits = orderData.credits || 0;
    const bonusCredits = orderData.bonusCredits || 0;
    const totalCredits = credits + bonusCredits;
    const bundleId = orderData.bundleId || 'unknown';
    const amountPaid = parseFloat(capture?.amount?.value || '0');

    if (totalCredits <= 0) {
      console.error('No credits in order data');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid order data - no credits specified',
        }),
      };
    }

    // Use Firestore transaction to add credits atomically
    const userRef = db.collection('users').doc(body.userId);
    const paymentLogRef = db.collection('paymentLogs').doc();
    const creditTxRef = db.collection('users').doc(body.userId).collection('creditTransactions').doc();

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const currentCredits = userDoc.data()?.credits || 0;
      const newBalance = currentCredits + totalCredits;

      // Update user credits
      transaction.update(userRef, {
        credits: newBalance,
        lifetimeCreditsEarned: admin.firestore.FieldValue.increment(totalCredits),
        lastCreditTransactionAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the credit transaction
      transaction.set(creditTxRef, {
        userId: body.userId,
        type: 'purchase',
        amount: totalCredits,
        balance: newBalance,
        description: `Purchased ${credits} credits${bonusCredits ? ` + ${bonusCredits} bonus` : ''}`,
        metadata: {
          paypalOrderId: body.paypalOrderId,
          paypalTransactionId: transactionId,
          bundleId,
          credits,
          bonusCredits,
          amountPaid,
          currency: capture?.amount?.currency_code || 'USD',
          payerEmail: captureData.payer?.email_address,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the payment for audit trail
      transaction.set(paymentLogRef, {
        type: 'credit_purchase',
        userId: body.userId,
        paypalOrderId: body.paypalOrderId,
        paypalTransactionId: transactionId,
        bundleId,
        credits,
        bonusCredits,
        totalCredits,
        amountPaid,
        currency: capture?.amount?.currency_code || 'USD',
        payerEmail: captureData.payer?.email_address,
        payerName: `${captureData.payer?.name?.given_name || ''} ${captureData.payer?.name?.surname || ''}`.trim(),
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`✅ Credits added: ${totalCredits} to user ${body.userId}, PayPal order: ${body.paypalOrderId}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        transactionId,
        creditsAdded: totalCredits,
        status: 'COMPLETED',
      }),
    };
  } catch (error) {
    console.error('Capture credit order error:', error);
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
