import 'reflect-metadata';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { StripePaymentOrders } from './stripe-payment/entities/stripe-payment.entity';

dotenv.config();

// Lê certificado SSL se estiver em produção
let ssl: boolean | { ca: string; rejectUnauthorized: boolean } = false;

if (process.env.NODE_ENV === 'production' && process.env.RDS_SSL_CA) {
  try {
    const caPath = path.resolve(process.env.RDS_SSL_CA);
    const caCert = fs.readFileSync(caPath, 'utf-8');
    ssl = { ca: caCert, rejectUnauthorized: true };
  } catch (err) {
    console.warn('Não foi possível ler certificado SSL da AWS. Conexão seguirá sem SSL.', err);
    ssl = false;
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.RDS_HOST,
  port: Number(process.env.RDS_PORT || 5432),
  username: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB,
  ssl,
  synchronize: false, // nunca use true em produção
  logging: false,
  entities: ['src/entities/**/*.ts', StripePaymentOrders], // todas as entities
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
