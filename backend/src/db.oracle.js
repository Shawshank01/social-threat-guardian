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


