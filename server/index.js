require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
// app.js veya server.js - en üste, middleware'lerden önce
app.set('trust proxy', 1); // Nginx/reverse proxy arkasındaysan


app.use((req, res, next) => {
  console.log('👣 IP tespit edildi:', req.ip, '| X-Forwarded-For:', req.headers['x-forwarded-for']);
  next();
});

// ─── Middleware ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  //keyGenerator: (req) => req.ip, // hangi IP’yi gördüğünü netleştirir
  message: { error: 'Çok fazla istek. 15 dakika sonra tekrar deneyin.' }
});
app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, '..', 'public')));
//app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes (SPA fallback'ten ÖNCE olmalı) ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/words', require('./routes/words'));
app.use('/api/review', require('./routes/review'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/lookup', require('./routes/lookup'));

// ─── Debug: Route'ların yüklendiğini doğrula ───
console.log('📌 Kayıtlı route\'lar:');
app._router.stack.forEach(r => {
  if (r.route) {
    console.log(`  ${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
  } else if (r.name === 'router' && r.regexp) {
    console.log(`  ROUTER: ${r.regexp}`);
  }
});

// ─── SPA Fallback (EN SONDA olmalı) ───
app.get('*', (req, res) => {
  // API isteklerini fallback'e düşürme
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint bulunamadı' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  //res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Sunucu hatası'
  });
});



app.listen(PORT, () => {
  console.log(`🚀 Reverso SR çalışıyor: http://localhost:${PORT}`);
});