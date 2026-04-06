const { sql } = require('@vercel/postgres');
const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://heywren.ai');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, source } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Upsert contact — if already exists, update source and resubscribe
    await sql`
      INSERT INTO contacts (email, source, status, created_at, updated_at)
      VALUES (${normalizedEmail}, ${source || 'website'}, 'active', NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        status = 'active',
        source = COALESCE(NULLIF(${source || 'website'}, ''), contacts.source),
        updated_at = NOW()
    `;

    // Send welcome email via Resend (if configured)
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'HeyWren <hello@heywren.ai>',
        to: normalizedEmail,
        subject: 'Welcome to HeyWren — nothing falls through the cracks',
        html: getWelcomeEmail(),
      });
    }

    return res.status(200).json({ success: true, message: 'Subscribed' });
  } catch (error) {
    console.error('Subscribe error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

function getWelcomeEmail() {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 40px;">
      <h1 style="color: white; font-size: 24px; margin: 0;">Welcome to HeyWren</h1>
    </div>
    <div style="padding: 40px;">
      <p style="font-size: 16px; color: #374151; line-height: 1.7; margin: 0 0 20px;">
        Thanks for signing up. You're now on the list for early access to HeyWren — the AI-powered work observability platform that ensures nothing falls through the cracks.
      </p>
      <p style="font-size: 16px; color: #374151; line-height: 1.7; margin: 0 0 20px;">
        HeyWren watches your Slack, email, and calendar to automatically detect commitments and nudge you before deadlines slip. No manual logging. No behavior change.
      </p>
      <p style="font-size: 16px; color: #374151; line-height: 1.7; margin: 0 0 28px;">
        We'll be in touch soon with your invite.
      </p>
      <a href="https://heywren.ai" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Visit HeyWren
      </a>
    </div>
    <div style="padding: 24px 40px; border-top: 1px solid #f3f4f6; text-align: center;">
      <p style="font-size: 13px; color: #9ca3af; margin: 0;">
        You're receiving this because you signed up at heywren.ai.<br>
        <a href="https://heywren.ai/api/unsubscribe?email={{email}}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
