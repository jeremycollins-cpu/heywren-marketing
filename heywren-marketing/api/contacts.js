const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  // Admin-only endpoint — protected by API key
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return listContacts(req, res);
  }

  if (req.method === 'DELETE') {
    return deleteContact(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function listContacts(req, res) {
  const status = req.query.status || 'active';
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const offset = parseInt(req.query.offset) || 0;
  const format = req.query.format || 'json';

  try {
    const { rows } = await sql`
      SELECT email, source, status, created_at, updated_at
      FROM contacts
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const { rows: countRows } = await sql`
      SELECT COUNT(*) as total FROM contacts WHERE status = ${status}
    `;

    if (format === 'csv') {
      const csv = 'email,source,status,created_at\n' +
        rows.map(r => `${r.email},${r.source},${r.status},${r.created_at}`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      contacts: rows,
      total: parseInt(countRows[0].total),
      limit,
      offset,
    });
  } catch (error) {
    console.error('List contacts error:', error);
    return res.status(500).json({ error: 'Failed to fetch contacts' });
  }
}

async function deleteContact(req, res) {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    await sql`DELETE FROM contacts WHERE email = ${email.toLowerCase().trim()}`;
    return res.status(200).json({ success: true, message: `Deleted ${email}` });
  } catch (error) {
    console.error('Delete contact error:', error);
    return res.status(500).json({ error: 'Failed to delete contact' });
  }
}
