import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to connect to Supabase PostgreSQL');
}

const db = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

db.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export default db;
