const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  // Admin-only
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rows } = await sql`
      SELECT id, subject, recipients, sent_at
      FROM campaigns
      ORDER BY sent_at DESC
      LIMIT 50
    `;

    return res.status(200).json({ campaigns: rows });
  } catch (error) {
    console.error('Campaigns list error:', error);
    return res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};
