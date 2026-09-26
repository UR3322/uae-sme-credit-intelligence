const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error('Configure DATABASE_URL or the standard PGHOST/PGUSER/PGDATABASE connection variables.');
}

const isProduction = process.env.NODE_ENV === 'production';
const poolOptions = {
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : (isProduction || process.env.DATABASE_SSL === 'true')
      ? { rejectUnauthorized: true }
      : false
};
if (process.env.DATABASE_URL) poolOptions.connectionString = process.env.DATABASE_URL;
const pool = new Pool(poolOptions);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
