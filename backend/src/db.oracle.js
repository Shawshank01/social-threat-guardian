import OracleDB from 'oracledb';
import oracledb from 'oracledb';


//create oracle connection pool
export async function initOraclePool() {
    const pool = OracleDB.createPool({
        user: process.env.ORA_USER,
        password: process.env.ORA_PASSWORD,
        connectString: process.env.ORA_CONNECT_STRING,
        poolMin: 1,
        poolMax: 5,
        poolIncrement: 1,
        queueRequests: true,
        queueTimeout: 60000
    });
    return pool;
}


export async function closeOraclePool() {
    try {
        oracledb.createPool().close(10);
    } catch (e) {
        console.error('Close Oracle pool error:', e);
    }
}

export async function runQuery(sql, binds = [], options = {}) {
  const pool = oracledb.getPool();
  const conn = await pool.getConnection();
  try {
    const res = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, ...options });
    return res;
  } finally {
    await conn.close();
  }
}
