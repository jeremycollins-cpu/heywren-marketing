const { sql } = require('@vercel/postgres');
const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  // Admin-only
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, html, text, test_email } = req.body || {};

  if (!subject || (!html && !text)) {
    return res.status(400).json({ error: 'Subject and html/text content required' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.EMAIL_FROM || 'HeyWren <hello@heywren.ai>';

  // If test_email is provided, only send to that address
  if (test_email) {
    try {
      await resend.emails.send({
        from,
        to: test_email,
        subject: `[TEST] ${subject}`,
        html: html || undefined,
        text: text || undefined,
      });
      return res.status(200).json({ success: true, sent: 1, test: true });
    } catch (error) {
      console.error('Test email error:', error);
      return res.status(500).json({ error: 'Failed to send test email' });
    }
  }

  // Send to all active subscribers
  try {
    const { rows: contacts } = await sql`
      SELECT email FROM contacts WHERE status = 'active'
    `;

    if (contacts.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'No active subscribers' });
    }

    // Log the campaign
    await sql`
      INSERT INTO campaigns (subject, html_body, recipients, sent_at)
      VALUES (${subject}, ${html || text}, ${contacts.length}, NOW())
    `;

    // Add unsubscribe link to HTML
    const htmlWithUnsub = html ? html.replace(
      '</body>',
      `<div style="text-align:center;padding:20px;font-size:12px;color:#9ca3af;">
        <a href="https://heywren.ai/api/unsubscribe?email={{email}}" style="color:#9ca3af;">Unsubscribe</a>
      </div></body>`
    ) : undefined;

    // Send in batches of 50 (Resend rate limit)
    let sent = 0;
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const promises = batch.map(contact =>
        resend.emails.send({
          from,
          to: contact.email,
          subject,
          html: htmlWithUnsub ? htmlWithUnsub.replace(/\{\{email\}\}/g, contact.email) : undefined,
          text: text || undefined,
        }).catch(err => {
          console.error(`Failed to send to ${contact.email}:`, err);
          return null;
        })
      );
      const results = await Promise.all(promises);
      sent += results.filter(r => r !== null).length;

      // Rate limit pause between batches
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.status(200).json({ success: true, sent, total: contacts.length });
  } catch (error) {
    console.error('Campaign send error:', error);
    return res.status(500).json({ error: 'Failed to send campaign' });
  }
};
