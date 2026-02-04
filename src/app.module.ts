import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as fs from 'fs';
import path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GoogleAuthModule } from './GoogleOAuth/google-auth.module';
import { StripePaymentModule } from './stripe-payment/stripe-payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000, // em milissegundos
          limit: 5, // requisições permitidas nessa janela
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Build SSL option similar to pool-Postgre.ts
        let ssl: any = false;
        try {
          const rdsSsl = config.get<string>('RDS_SSL_CA');
          if (process.env.NODE_ENV === 'production' && rdsSsl) {
            const caPath = rdsSsl;
            const caCert = fs.readFileSync(path.resolve(caPath)).toString();
            ssl = { ca: caCert, rejectUnauthorized: true };
          }
        } catch (e) {
          ssl = false;
        }

        return {
          type: 'postgres',
          host: config.get<string>('RDS_HOST') || undefined,
          port: config.get<string>('RDS_PORT')
            ? Number(config.get<string>('RDS_PORT'))
            : 5432,
          username: config.get<string>('RDS_USER') || undefined,
          password: config.get<string>('RDS_PASSWORD') || undefined,
          database: config.get<string>('RDS_DB') || undefined,
          ssl,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
    GoogleAuthModule,
    StripePaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
