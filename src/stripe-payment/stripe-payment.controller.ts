import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { StripePaymentService } from './stripe-payment.service';
import { CreateStripePaymentDto } from './dto/create-stripe-payment.dto';
import { AuthGuard } from 'src/guards/auth.guard';
import { UserForCheckout } from 'src/GoogleOAuth/types/types';
import type { Request, Response } from 'express';
import stripe from 'stripe';

export interface RequestWithUser extends Request {
  user: UserForCheckout;
}

export interface StripeRequest extends Request {
  rawBody: Buffer;
}

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}

  @Get('success')
  success() {
    return 'Pagamento iniciado com sucesso';
  }

  @Get('cancel')
  cancel() {
    return 'Pagamento cancelado';
  }
  // ENDPOINT QUE CRIA A SESSÃO DE CHECKOUT DO STRIPE E RETORNA A URL PARA O FRONTEND
  @Post('checkout-session')
  @UseGuards(AuthGuard)
  async checkout(
    @Body() body: CreateStripePaymentDto,
    @Req() req: RequestWithUser,
  ) {
    console.log('Iniciando checkout session...');
    const userRequested = req.user;
    if (!userRequested) {
      throw new Error('Usuário não autenticado');
    }
    if (userRequested.hasPlan) {
      throw new Error('Você já possui um plano ativo');
    }

    console.log('user.id:', userRequested.id);
    // Cria objeto que contem stripe url, abaixo desconstrução// AQUI E
    const { url } = await this.stripePaymentService.checkout(
      body.plan,
      userRequested,
    );
    console.log('userId retornado:', userRequested.id);
    console.log('aqui esta o user', userRequested);
    console.log('body.plan:', body.plan);
    console.log('AQUI ESTÁ A URL:', url);
    if (!url) throw new Error('Falha ao criar sessão Stripe');
    return { url };
  }

  // ENDPOINT PARA RECEBER OS EVENTOS DO WEBHOOK DO STRIPE
  @Post('webhook')
  async handleWebhook(@Req() req: StripeRequest, @Res() res: Response) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const rawBody = req.rawBody;
    const sig = req.headers['stripe-signature'] as string;
    let event: stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Passa o evento para o service processar
    await this.stripePaymentService.processEvent(event);

    res.json({ received: true });
  }
}
