import { Handler } from '@netlify/functions';

// This function generates wallet passes for Apple Wallet and Google Wallet
// For full production use, you'll need:
// - Apple: Apple Developer account, PassKit certificates
// - Google: Google Pay API for Passes credentials

interface WalletPassRequest {
  ticketId: string;
  type: 'apple' | 'google';
}

interface TicketData {
  ticketNumber: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  teamName: string;
  ownerName: string;
  qrCode: string;
  tierName?: string;
}

/**
 * Generate Apple Wallet pass (PKPass)
 * NOTE: Full implementation requires PassKit certificates
 * This returns a mock response for demo purposes
 */
async function generateAppleWalletPass(ticketData: TicketData): Promise<{ success: boolean; passUrl?: string; error?: string }> {
  // In production, you would:
  // 1. Create a pass.json with ticket details
  // 2. Sign it with your Apple Developer certificates
  // 3. Bundle as .pkpass file
  // 4. Return download URL
  
  // For now, we'll create a simple pass using Apple's direct add to wallet URL
  // This is a simplified approach - production should use proper PKPass signing
  
  const passData = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.team.osys.tickets',
    serialNumber: ticketData.ticketNumber,
    teamIdentifier: process.env.APPLE_TEAM_ID || 'XXXXXXXXXX',
    organizationName: 'OSYS',
    description: `Ticket for ${ticketData.eventTitle}`,
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(26, 26, 46)',
    labelColor: 'rgb(251, 191, 36)',
    eventTicket: {
      primaryFields: [
        {
          key: 'event',
          label: 'EVENT',
          value: ticketData.eventTitle
        }
      ],
      secondaryFields: [
        {
          key: 'date',
          label: 'DATE',
          value: ticketData.eventDate
        },
        {
          key: 'time',
          label: 'TIME',
          value: ticketData.eventTime
        }
      ],
      auxiliaryFields: [
        {
          key: 'location',
          label: 'LOCATION',
          value: ticketData.eventLocation
        },
        {
          key: 'team',
          label: 'TEAM',
          value: ticketData.teamName
        }
      ],
      backFields: [
        {
          key: 'ticketNumber',
          label: 'TICKET NUMBER',
          value: ticketData.ticketNumber
        },
        {
          key: 'holder',
          label: 'TICKET HOLDER',
          value: ticketData.ownerName
        }
      ]
    },
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: ticketData.qrCode,
      messageEncoding: 'iso-8859-1',
      altText: ticketData.ticketNumber
    }
  };

  // In production, this would be signed and hosted
  // For demo, we return a data URL that can be used to show instructions
  const encodedPass = Buffer.from(JSON.stringify(passData)).toString('base64');
  
  return {
    success: true,
    // In production: actual .pkpass file URL
    // For demo: instructions page with the pass data
    passUrl: `${process.env.URL || 'https://osys.team'}/wallet/apple-instructions?data=${encodedPass}&ticket=${ticketData.ticketNumber}`
  };
}

/**
 * Generate Google Wallet pass
 * NOTE: Full implementation requires Google Pay API credentials
 * This returns a mock response for demo purposes
 */
async function generateGoogleWalletPass(ticketData: TicketData): Promise<{ success: boolean; passUrl?: string; error?: string }> {
  // In production, you would:
  // 1. Create a JWT with ticket details
  // 2. Sign it with your Google service account
  // 3. Return the "Add to Google Wallet" URL
  
  // Google Wallet pass object
  const passObject = {
    id: `osys.ticket.${ticketData.ticketNumber}`,
    classId: `${process.env.GOOGLE_ISSUER_ID || 'ISSUER_ID'}.osys_event_ticket`,
    eventName: {
      defaultValue: {
        language: 'en-US',
        value: ticketData.eventTitle
      }
    },
    venue: {
      name: {
        defaultValue: {
          language: 'en-US',
          value: ticketData.eventLocation
        }
      }
    },
    dateTime: {
      start: ticketData.eventDate, // Should be ISO format
    },
    ticketNumber: ticketData.ticketNumber,
    ticketHolderName: ticketData.ownerName,
    barcode: {
      type: 'QR_CODE',
      value: ticketData.qrCode,
      alternateText: ticketData.ticketNumber
    },
    hexBackgroundColor: '#1a1a2e',
    logo: {
      sourceUri: {
        uri: `${process.env.URL || 'https://osys.team'}/icons/icon-192x192.png`
      }
    }
  };

  // In production, sign with Google service account and create JWT
  const encodedPass = Buffer.from(JSON.stringify(passObject)).toString('base64');
  
  return {
    success: true,
    // In production: actual Google Pay save URL
    // For demo: instructions page
    passUrl: `${process.env.URL || 'https://osys.team'}/wallet/google-instructions?data=${encodedPass}&ticket=${ticketData.ticketNumber}`
  };
}

const handler: Handler = async (event) => {
  // Allow GET for easy linking
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const ticketId = event.queryStringParameters?.ticketId;
    const type = event.queryStringParameters?.type as 'apple' | 'google';
    
    if (!ticketId || !type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing ticketId or type parameter' }),
      };
    }

    if (type !== 'apple' && type !== 'google') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Type must be "apple" or "google"' }),
      };
    }

    // In production, fetch ticket data from Firestore
    // For now, we'll use placeholder data or parse from query params
    const ticketData: TicketData = {
      ticketNumber: event.queryStringParameters?.ticketNumber || 'OSYS-XXXX-XXXX',
      eventTitle: event.queryStringParameters?.eventTitle || 'Game Day',
      eventDate: event.queryStringParameters?.eventDate || 'TBD',
      eventTime: event.queryStringParameters?.eventTime || 'TBD',
      eventLocation: event.queryStringParameters?.eventLocation || 'Stadium',
      teamName: event.queryStringParameters?.teamName || 'Team',
      ownerName: event.queryStringParameters?.ownerName || 'Ticket Holder',
      qrCode: event.queryStringParameters?.qrCode || `OSYS:${ticketId}:${Date.now()}`,
      tierName: event.queryStringParameters?.tierName,
    };

    let result;
    if (type === 'apple') {
      result = await generateAppleWalletPass(ticketData);
    } else {
      result = await generateGoogleWalletPass(ticketData);
    }

    if (!result.success) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: result.error }),
      };
    }

    // Option 1: Return JSON with pass URL
    if (event.queryStringParameters?.format === 'json') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, passUrl: result.passUrl }),
      };
    }

    // Option 2: Redirect to pass URL (for direct linking from emails)
    return {
      statusCode: 302,
      headers: {
        'Location': result.passUrl || '/',
      },
      body: '',
    };
  } catch (error) {
    console.error('Generate wallet pass error:', error);
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
