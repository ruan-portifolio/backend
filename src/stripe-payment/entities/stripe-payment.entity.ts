import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('stripe_orders')
export class StripePaymentOrders {
  @PrimaryGeneratedColumn('uuid')
  id: string; // UUID interno da tabela

  @Column({ unique: true })
  checkoutSessionId: string; // id da sessão Stripe (imutável)

  @Column()
  userId: string; // referência ao usuário no seu banco

  @Column()
  subscriptionId: string; // id da assinatura Stripe

  @Column()
  invoiceId: string; // id da fatura Stripe

  @Column('int')
  amountTotal: number; // valor pago em centavos

  @Column()
  currency: string; // ex: 'brl'

  @Column({ type: 'timestamptz' })
  currentPeriodEnd: Date; // quando a assinatura expira

  @Column()
  paymentStatus: string; // 'paid', 'unpaid', etc

  @CreateDateColumn()
  createdAt: Date;
}
