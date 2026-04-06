module.exports = async function handler(req, res) {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.status(200).json({ success: true, message: 'Authenticated' });
};
