const jwt = require('jsonwebtoken');
const db = require('../db');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Yetkilendirme gerekli' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kullanıcıyı doğrula
    const [rows] = await db.query(
      'SELECT id, email, username, display_name, timezone, preferred_lang, daily_goal FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Oturum süresi doldu' });
    }
    return res.status(401).json({ error: 'Geçersiz token' });
  }
}

module.exports = authenticate;