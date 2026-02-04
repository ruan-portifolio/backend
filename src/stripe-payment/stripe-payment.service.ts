import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStripePaymentDto } from './dto/create-stripe-payment.dto';
import { UserForCheckout } from 'src/GoogleOAuth/types/types';
import Stripe from 'stripe';
import { StripePaymentOrders } from './entities/stripe-payment.entity';
import { TenantUser } from 'src/entities/tenant-user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators';

interface StripeInvoiceWithSubscription extends Stripe.Invoice {
  period_end: number;
  subscription: string;
}

@Injectable()
export class StripePaymentService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(TenantUser)
    private readonly tenantUserRepository: Repository<TenantUser>,

    @InjectRepository(StripePaymentOrders)
    private readonly stripeOrdersRepository: Repository<StripePaymentOrders>,
  ) {
    // inicializa o Stripe dentro do mesmo construtor
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-08-16' as unknown as any, // ou process.env.STRIPE_API_VERSION as string
    });
  }

  // METODO PARA CRIAR A SESSÃO DE CHECKOUT
  async checkout(plan: CreateStripePaymentDto['plan'], user: UserForCheckout) {
    const priceMap = {
      basic: process.env.STRIPE_PRICE_BASIC,
      pro: process.env.STRIPE_PRICE_PRO,
    };
    // Verifica se o plano é valido de acordo com o mapeamento das variaveis de ambiente
    const priceId = priceMap[plan];
    if (!priceId) {
      throw new BadRequestException('Plano inválido');
    }
    // Função do stripe para criar a sessão de checkout
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_collection: process.env
        .STRIPE_PAYMENT_METHOD_COLLECTION as 'always',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
      metadata: {
        userId: user.id,
      },
    });
    console.log(session);
    return { url: session.url };
  }
  // METODO PARA TRATAR A RESPOSTA DO WEBHOOK DO STRIPE

  async processEvent(event: Stripe.Event) {
    switch (event.type) {
      // Caso de evento de finalização de checkout concluído
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (!session.subscription) {
          throw new Error('Subscription ID ausente na sessão');
        }

        // Evita processamento duplicado do webhook
        const verifyDuplifiedSession =
          await this.stripeOrdersRepository.findOneBy({
            checkoutSessionId: session.id,
          });
        if (verifyDuplifiedSession) {
          console.log(`Webhook duplicado ignorado: ${session.id}`);
          return;
        }

        // Pega o metadata do userID para confirmar para quem deve ser atribuído o plano
        const userId = session.metadata?.userId as string;

        // Cria o paymentOrder apenas para registro do pagamento (status pendente)
        const paymentOrder = new StripePaymentOrders();
        paymentOrder.checkoutSessionId = session.id;
        paymentOrder.userId = userId;
        paymentOrder.subscriptionId = session.subscription as string;

        const latestInvoice = await this.stripe.invoices.retrieve(
          session.subscription as string, // apenas para pegar dados do pagamento
        );
        paymentOrder.invoiceId = latestInvoice.id;
        paymentOrder.amountTotal = latestInvoice.amount_paid;
        paymentOrder.currency = latestInvoice.currency;
        paymentOrder.paymentStatus = 'pending'; // não confirmado ainda

        await this.stripeOrdersRepository.save(paymentOrder);
        console.log('Pagamento registrado com sucesso:', paymentOrder);
        break;
      }

      // Case: pagamento confirmado**
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as StripeInvoiceWithSubscription;
        console.log('Invoice recebida:', invoice);
        if (!invoice.subscription) throw new Error('Subscription ausente');

        // Recupera a subscription real
        const subscription = await this.stripe.subscriptions.retrieve(
          invoice.subscription,
        );
        console.log('Subscription recuperada:', subscription);

        // Busca o usuário pelo metadata
        const user = await this.tenantUserRepository.findOneBy({
          id: invoice.metadata?.userId,
        });
        if (!user) throw new Error('Usuário não encontrado');
        // if (!subscription.period_end) {
        //   throw new Error('current_period_end ausente na subscription');
        // }
        // Atualiza BCE e libera acesso
        // user.billingCycleEnd = new Date(subscription.period_end * 1000);
        user.status = true;
        await this.tenantUserRepository.save(user);

        // Atualiza paymentOrder existente
        // const paymentOrder = await this.stripeOrdersRepository.findOneBy({
        //   checkoutSessionId: invoice.checkout_session as string,
        // });
        // if (paymentOrder) {
        //   paymentOrder.paymentStatus = 'paid';
        //   paymentOrder.currentPeriodEnd = user.billingCycleEnd;
        //   await this.stripeOrdersRepository.save(paymentOrder);
        // }

        console.log(
          'Pagamento confirmado e plano atualizado para o usuário:',
          user.id,
        );
        break;
      }
      // Falha no pagamento
      case 'invoice.payment_failed': {
        // Tenta procurar o usuário pelo id que colocamos no metadata.userId.
        try {
          const invoice = event.data.object as StripeInvoiceWithSubscription;
          const user = await this.tenantUserRepository.findOneBy({
            id: invoice.metadata?.userId,
          });
          if (!user) {
            console.warn('Usuário não encontrado para invoice.payment_failed');
            break;
          }

          // Procura a fatura utilizando a coluna subcriptionId e procura o pedido invoice especifico que falhou para atualiza-lo
          const paymentOrder = await this.stripeOrdersRepository.findOneBy({
            subscriptionId: invoice.subscription,
          });
          // Esse trecho verifica se o paymentOrder existe antes de tentar atualizar o status
          if (paymentOrder) {
            paymentOrder.paymentStatus = 'failed';
            await this.stripeOrdersRepository.save(paymentOrder);
          }

          console.log(
            'Pagamento falhou. Acesso suspenso para o usuário:',
            user.id,
          );
        } catch (err) {
          console.error('Erro ao processar invoice.payment_failed:', err);
        }
        break;
      }
      // Atualização da assinatura
      case 'customer.subscription.updated': {
        // Verifica se o usuario existe antes de atualizar os dados
        try {
          const subscription = event.data.object;
          const user = await this.tenantUserRepository.findOneBy({
            id: subscription.metadata?.userId,
          });
          if (!user) {
            console.warn('Usuário não encontrado para subscription.updated');
            break;
          }
          // Atualiza o novo tempo de expiração de plano e status da assinatura
          // user.billingCycleEnd = new Date(subscription.currentPeriodEnd * 1000);
          user.status = subscription.status === 'active';
          await this.tenantUserRepository.save(user);

          console.log('Assinatura atualizada para o usuário:', user.id);
        } catch (err) {
          console.error(
            'Erro ao processar customer.subscription.updated:',
            err,
          );
        }
        break;
      }
      // Assinatura cancelada
      case 'customer.subscription.deleted': {
        try {
          const subscription = event.data.object;
          const user = await this.tenantUserRepository.findOneBy({
            id: subscription.metadata?.userId,
          });
          if (!user) {
            console.warn('Usuário não encontrado para subscription.deleted');
            break;
          }

          user.status = false;
          // user.billingCycleEnd = null;
          await this.tenantUserRepository.save(user);

          console.log(
            'Assinatura cancelada. Acesso revogado para o usuário:',
            user.id,
          );
        } catch (err) {
          console.error(
            'Erro ao processar customer.subscription.deleted:',
            err,
          );
        }
        break;
      }
      default:
        console.log(`Evento não tratado: ${event.type}`);
    }
  }
}
