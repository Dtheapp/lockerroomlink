import { Handler } from '@netlify/functions';

// Resend API for email delivery
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'tickets@osys.team';

interface Ticket {
  id: string;
  ticketNumber: string;
  qrCode: string;
  ownerName: string;
  tierName?: string;
  price: number;
}

interface SendTicketEmailRequest {
  orderId: string;
  tickets: Ticket[];
  buyerEmail: string;
  buyerName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  teamName: string;
}

/**
 * Generate QR code as data URL using a simple SVG approach
 * For production, use a proper QR library
 */
function generateQRCodeSVG(data: string, size: number = 150): string {
  // This is a placeholder - in production, use a QR code library
  // For now, we'll create a simple placeholder that shows the ticket number
  const ticketNum = data.split(':')[2] || 'TICKET';
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="10" y="10" width="${size-20}" height="${size-20}" fill="#1a1a2e" rx="8"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="monospace" font-size="10">${ticketNum}</text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#fbbf24" font-family="monospace" font-size="8">SCAN TO ENTER</text>
    </svg>
  `.trim();
}

/**
 * Generate the HTML email template
 */
function generateEmailHTML(request: SendTicketEmailRequest): string {
  const ticketsHTML = request.tickets.map(ticket => {
    const qrSvg = generateQRCodeSVG(ticket.qrCode, 120);
    const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`;
    
    return `
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 24px; margin-bottom: 16px; border: 1px solid rgba(251, 191, 36, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="color: #fbbf24; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
              ${ticket.tierName || 'General Admission'}
            </div>
            <div style="color: white; font-size: 18px; font-weight: 600; margin-bottom: 8px;">
              ${request.eventTitle}
            </div>
            <div style="color: #9ca3af; font-size: 14px; margin-bottom: 4px;">
              📅 ${request.eventDate} at ${request.eventTime}
            </div>
            <div style="color: #9ca3af; font-size: 14px; margin-bottom: 12px;">
              📍 ${request.eventLocation}
            </div>
            <div style="background: rgba(251, 191, 36, 0.1); border-radius: 8px; padding: 8px 12px; display: inline-block;">
              <span style="color: #fbbf24; font-family: monospace; font-size: 14px; font-weight: 600;">
                ${ticket.ticketNumber}
              </span>
            </div>
          </div>
          <div style="text-align: center; margin-left: 20px;">
            <img src="${qrDataUrl}" alt="QR Code" style="width: 120px; height: 120px; border-radius: 8px;"/>
            <div style="color: #6b7280; font-size: 10px; margin-top: 4px;">Scan at gate</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your OSYS Tickets</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              <div style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #fbbf24, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                OSYS
              </div>
              <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">
                Organization System for Youth Sports
              </div>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding-bottom: 24px;">
              <h1 style="color: white; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">
                🎟️ Your Tickets Are Ready!
              </h1>
              <p style="color: #9ca3af; font-size: 16px; margin: 0;">
                Hi ${request.buyerName}, here are your tickets for the event.
              </p>
            </td>
          </tr>
          
          <!-- Team Name -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background: rgba(251, 191, 36, 0.1); border-radius: 12px; padding: 16px; text-align: center;">
                <div style="color: #fbbf24; font-size: 14px; font-weight: 600;">
                  🏈 ${request.teamName}
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Tickets -->
          <tr>
            <td style="padding-bottom: 32px;">
              ${ticketsHTML}
            </td>
          </tr>
          
          <!-- Add to Wallet Buttons -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <p style="color: #9ca3af; font-size: 14px; margin-bottom: 16px;">
                Add to your phone wallet for easy access at the gate:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding-right: 12px;">
                    <a href="${process.env.URL || 'https://osys.team'}/api/wallet/apple/${request.tickets[0]?.id}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
                       Add to Apple Wallet
                    </a>
                  </td>
                  <td>
                    <a href="${process.env.URL || 'https://osys.team'}/api/wallet/google/${request.tickets[0]?.id}" style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
                      📱 Add to Google Wallet
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Instructions -->
          <tr>
            <td style="padding-bottom: 32px;">
              <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px;">
                <h3 style="color: white; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                  📋 How to Use Your Tickets
                </h3>
                <ol style="color: #9ca3af; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Save this email or add to your phone wallet</li>
                  <li>Show the QR code at the gate on game day</li>
                  <li>The gate volunteer will scan your code</li>
                  <li>Enjoy the event! 🎉</li>
                </ol>
              </div>
            </td>
          </tr>
          
          <!-- Order Details -->
          <tr>
            <td style="padding-bottom: 32px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  Order ID: ${request.orderId}<br>
                  ${request.tickets.length} ticket(s) purchased
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 24px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Questions? Contact the team directly or reply to this email.<br>
                <a href="https://osys.team" style="color: #fbbf24; text-decoration: none;">osys.team</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generate plain text version of the email
 */
function generateEmailText(request: SendTicketEmailRequest): string {
  const ticketsText = request.tickets.map(ticket => `
Ticket: ${ticket.ticketNumber}
Type: ${ticket.tierName || 'General Admission'}
`).join('\n');

  return `
OSYS - Your Tickets Are Ready!

Hi ${request.buyerName},

Here are your tickets for:

EVENT: ${request.eventTitle}
TEAM: ${request.teamName}
DATE: ${request.eventDate} at ${request.eventTime}
LOCATION: ${request.eventLocation}

YOUR TICKETS:
${ticketsText}

HOW TO USE:
1. Save this email or screenshot the ticket
2. Show the ticket number at the gate
3. The gate volunteer will verify your entry
4. Enjoy the event!

Order ID: ${request.orderId}
${request.tickets.length} ticket(s) purchased

---
Questions? Contact the team directly or reply to this email.
https://osys.team
  `.trim();
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
    const request: SendTicketEmailRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!request.buyerEmail || !request.tickets?.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Check if Resend API key is configured
    if (!RESEND_API_KEY) {
      console.warn('Resend API key not configured - skipping email');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Email skipped - API not configured',
          skipped: true 
        }),
      };
    }

    // Generate email content
    const htmlContent = generateEmailHTML(request);
    const textContent = generateEmailText(request);

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `OSYS Tickets <${FROM_EMAIL}>`,
        to: [request.buyerEmail],
        subject: `🎟️ Your Tickets for ${request.eventTitle} - ${request.teamName}`,
        html: htmlContent,
        text: textContent,
        tags: [
          { name: 'category', value: 'ticket' },
          { name: 'orderId', value: request.orderId },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Failed to send email' 
        }),
      };
    }

    const result = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        emailId: result.id,
      }),
    };
  } catch (error) {
    console.error('Send ticket email error:', error);
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
