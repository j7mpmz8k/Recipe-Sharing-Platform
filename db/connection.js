import 'dotenv/config';
import pg from 'pg'

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function query(queryStr, params = []) {
    const client = await pool.connect();
    try {
        const data = await client.query(queryStr, params);
        return data.rows;
    } catch (error) {
        console.error("Database query error:", error);
        throw error;
    } finally {
        client.release();
    }
}

export default query;
