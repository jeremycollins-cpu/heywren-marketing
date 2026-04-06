const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
  // Admin-only — run once to create tables
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST to run setup' });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        source VARCHAR(100) DEFAULT 'website',
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        subject VARCHAR(500) NOT NULL,
        html_body TEXT,
        recipients INTEGER DEFAULT 0,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    return res.status(200).json({
      success: true,
      message: 'Database tables created',
      tables: ['contacts', 'campaigns'],
    });
  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: error.message });
  }
};
