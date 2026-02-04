import { Module } from '@nestjs/common';
import { StripePaymentService } from './stripe-payment.service';
import { StripeController } from './stripe-payment.controller';
import { AuthGuard } from 'src/guards/auth.guard';
import { GoogleAuthModule } from 'src/GoogleOAuth/google-auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripePaymentOrders } from './entities/stripe-payment.entity';
import { TenantUser } from 'src/entities/tenant-user.entity';
@Module({
  imports: [
    GoogleAuthModule,
    TypeOrmModule.forFeature([StripePaymentOrders, TenantUser]),
  ],
  controllers: [StripeController],
  providers: [StripePaymentService, AuthGuard],
})
export class StripePaymentModule {}
