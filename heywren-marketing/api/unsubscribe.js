const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  const email = (req.query.email || '').toLowerCase().trim();

  if (!email || !email.includes('@')) {
    return res.status(400).send(page('Invalid email', 'Please use the unsubscribe link from your email.'));
  }

  try {
    await sql`
      UPDATE contacts SET status = 'unsubscribed', updated_at = NOW()
      WHERE email = ${email}
    `;

    return res.status(200).send(page(
      'Unsubscribed',
      `<strong>${email}</strong> has been removed from our mailing list. You won't receive any more emails from us.`
    ));
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return res.status(500).send(page('Error', 'Something went wrong. Please email hello@heywren.ai to unsubscribe.'));
  }
};

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — HeyWren</title>
  <style>
    body { font-family: 'Inter', -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fafbfc; color: #374151; }
    .card { text-align: center; max-width: 420px; padding: 48px 40px; background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    h1 { font-size: 24px; color: #1f2937; margin-bottom: 12px; }
    p { font-size: 16px; line-height: 1.6; color: #6b7280; }
    a { color: #4f46e5; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top: 24px;"><a href="https://heywren.ai">← Back to HeyWren</a></p>
  </div>
</body>
</html>`;
}
