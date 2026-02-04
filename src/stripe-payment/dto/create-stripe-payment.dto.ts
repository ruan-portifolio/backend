import { IsIn } from 'class-validator';

export class CreateStripePaymentDto {
  @IsIn(['basic', 'pro'])
  plan: 'basic' | 'pro';
}
