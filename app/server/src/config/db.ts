import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString:
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@127.0.0.1:5432/zupply',
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);