/**
 * Notification utilities for ShotFlow
 * Supports Email and Slack notifications
 */

interface NotificationPayload {
  type: 'assignment' | 'review_request' | 'approval' | 'rejection' | 'comment';
  recipientEmail?: string;
  recipientName?: string;
  slackChannel?: string;
  slackWebhook?: string;
  data: {
    projectName?: string;
    turnoverNumber?: number;
    vendorName?: string;
    shotCodes?: string[];
    shotCount?: number;
    reviewUrl?: string;
    notes?: string;
    reviewerName?: string;
  };
}

// Email via Resend (or any provider)
async function sendEmail(payload: NotificationPayload): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !payload.recipientEmail) return false;

  const subject = getEmailSubject(payload);
  const html = getEmailHtml(payload);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'ShotFlow <notifications@shotflow.app>',
        to: payload.recipientEmail,
        subject,
        html,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

// Slack via webhook
async function sendSlack(payload: NotificationPayload): Promise<boolean> {
  const webhook = payload.slackWebhook || process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return false;

  const message = getSlackMessage(payload);

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    return res.ok;
  } catch (err) {
    console.error('Slack send error:', err);
    return false;
  }
}

function getEmailSubject(payload: NotificationPayload): string {
  const { type, data } = payload;
  
  switch (type) {
    case 'assignment':
      return `[ShotFlow] New shots assigned - ${data.projectName} TO${data.turnoverNumber}`;
    case 'review_request':
      return `[ShotFlow] Review requested - ${data.projectName}`;
    case 'approval':
      return `[ShotFlow] Shots approved - ${data.projectName}`;
    case 'rejection':
      return `[ShotFlow] Revisions requested - ${data.projectName}`;
    case 'comment':
      return `[ShotFlow] New comment - ${data.projectName}`;
    default:
      return '[ShotFlow] Notification';
  }
}

function getEmailHtml(payload: NotificationPayload): string {
  const { type, data, recipientName } = payload;
  
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hello,';
  
  let body = '';
  
  switch (type) {
    case 'assignment':
      body = `
        <p>You have been assigned <strong>${data.shotCount} shot(s)</strong> from ${data.projectName}.</p>
        <p><strong>Turnover:</strong> TO${data.turnoverNumber}</p>
        <p><strong>Shots:</strong> ${data.shotCodes?.join(', ')}</p>
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
      `;
      break;
    case 'review_request':
      body = `
        <p>Shots are ready for your review.</p>
        <p><strong>Project:</strong> ${data.projectName}</p>
        ${data.reviewUrl ? `<p><a href="${data.reviewUrl}">Click here to review</a></p>` : ''}
      `;
      break;
    case 'approval':
      body = `
        <p>Shots have been approved by ${data.reviewerName}.</p>
        <p><strong>Project:</strong> ${data.projectName}</p>
        <p><strong>Shots:</strong> ${data.shotCodes?.join(', ')}</p>
      `;
      break;
    case 'rejection':
      body = `
        <p>Revisions have been requested by ${data.reviewerName}.</p>
        <p><strong>Project:</strong> ${data.projectName}</p>
        <p><strong>Shots:</strong> ${data.shotCodes?.join(', ')}</p>
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
      `;
      break;
    default:
      body = '<p>You have a new notification from ShotFlow.</p>';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        a { color: #3b82f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">ShotFlow</h1>
        </div>
        <div class="content">
          <p>${greeting}</p>
          ${body}
        </div>
        <div class="footer">
          <p>This is an automated notification from ShotFlow.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getSlackMessage(payload: NotificationPayload): object {
  const { type, data } = payload;
  
  let text = '';
  let blocks: any[] = [];
  
  switch (type) {
    case 'assignment':
      text = `New shots assigned to ${data.vendorName}`;
      blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🎬 New Shot Assignment', emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Project:*\n${data.projectName}` },
            { type: 'mrkdwn', text: `*Turnover:*\nTO${data.turnoverNumber}` },
            { type: 'mrkdwn', text: `*Vendor:*\n${data.vendorName}` },
            { type: 'mrkdwn', text: `*Shots:*\n${data.shotCount}` },
          ]
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Shot Codes:*\n\`${data.shotCodes?.join('`, `')}\`` }
        }
      ];
      break;
    case 'approval':
      text = `Shots approved for ${data.projectName}`;
      blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: '✅ Shots Approved', emoji: true }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${data.reviewerName}* approved shots for *${data.projectName}*` }
        }
      ];
      break;
    case 'rejection':
      text = `Revisions requested for ${data.projectName}`;
      blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔄 Revisions Requested', emoji: true }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${data.reviewerName}* requested revisions for *${data.projectName}*` }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Notes:*\n${data.notes || 'No notes provided'}` }
        }
      ];
      break;
    default:
      text = 'ShotFlow notification';
  }

  return { text, blocks };
}

// Main notification function
export async function sendNotification(payload: NotificationPayload): Promise<{ email: boolean; slack: boolean }> {
  const [emailResult, slackResult] = await Promise.all([
    sendEmail(payload),
    sendSlack(payload),
  ]);

  return { email: emailResult, slack: slackResult };
}

// Convenience functions
export async function notifyVendorAssignment(params: {
  vendorEmail: string;
  vendorName: string;
  projectName: string;
  turnoverNumber: number;
  shotCodes: string[];
  notes?: string;
  slackWebhook?: string;
}): Promise<void> {
  await sendNotification({
    type: 'assignment',
    recipientEmail: params.vendorEmail,
    recipientName: params.vendorName,
    slackWebhook: params.slackWebhook,
    data: {
      projectName: params.projectName,
      turnoverNumber: params.turnoverNumber,
      vendorName: params.vendorName,
      shotCodes: params.shotCodes,
      shotCount: params.shotCodes.length,
      notes: params.notes,
    },
  });
}

export async function notifyReviewRequest(params: {
  clientEmail: string;
  clientName: string;
  projectName: string;
  reviewUrl: string;
}): Promise<void> {
  await sendNotification({
    type: 'review_request',
    recipientEmail: params.clientEmail,
    recipientName: params.clientName,
    data: {
      projectName: params.projectName,
      reviewUrl: params.reviewUrl,
    },
  });
}
