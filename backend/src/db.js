import pg from 'pg';
import 'dotenv/config';
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://ncrtc_app:ncrtc_local_dev_password@localhost:5432/ncrtc_bms' });
pool.on('error', err => console.error('Unexpected PostgreSQL pool error:', err.message));
export async function query(text, params = []) { return pool.query(text, params); }
