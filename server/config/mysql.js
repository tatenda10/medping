const mysql = require('mysql2/promise');
const config = require('./env');

if (!config.DATABASE_URL) {
  // Fail fast so we don't run with an undefined connection string
  throw new Error('DATABASE_URL is not set');
}

const pool = mysql.createPool(config.DATABASE_URL);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function transaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn({
      query: async (sql, params = []) => {
        const [rows] = await connection.execute(sql, params);
        return rows;
      },
      execute: async (sql, params = []) => {
        const [res] = await connection.execute(sql, params);
        return res;
      },
      connection,
    });
    await connection.commit();
    return result;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  transaction,
};

