// db.js — PostgreSQL database for Kudumbam Expense Tracker 

require('dotenv').config();

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured in .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// PostgreSQL-compatible database wrapper
const db = {
  pool,

  async query(text, params = []) {
    return pool.query(text, params);
  },

  prepare(sql) {
    return {
      async get(...params) {
        const result = await pool.query(sql, params);
        return result.rows[0];
      },

      async all(...params) {
        const result = await pool.query(sql, params);
        return result.rows;
      },

      async run(...params) {
        const result = await pool.query(sql, params);

        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id
        };
      }
    };
  },

  async close() {
    await pool.end();
  }
};

module.exports = db;
