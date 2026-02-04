import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const caPath = process.env.RDS_SSL_CA!;
const caCert = fs.readFileSync(path.resolve(caPath)).toString();

export const pool = new Pool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB,
  port: Number(process.env.RDS_PORT || 5432),
  ssl:
    process.env.NODE_ENV === 'production'
      ? { ca: caCert, rejectUnauthorized: true }
      : false,
});
