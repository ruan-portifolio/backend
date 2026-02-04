import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { StripeRequest } from './stripe-payment/stripe-payment.controller';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    // Adiciona rawBody para req com o tipo stripe request(Está no controlador do stripe)
    bodyParser.json({
      verify: (req: any, res, buf) => {
        (req as StripeRequest).rawBody = buf;
      },
    }),
  );
  app.enableCors({
    origin: 'http://localhost:3001',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.use(cookieParser());
  await app.listen(process.env.PORT ?? 3000);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}
bootstrap();
