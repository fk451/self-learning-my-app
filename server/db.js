const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sifreyok.1AA',
  database: process.env.DB_NAME || 'reverso_sr',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true
});

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL bağlantısı başarılı');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL bağlantı hatası:', err.message);
  });

module.exports = pool;