import { Controller, Get, Query, Res, Req, UseGuards } from '@nestjs/common';
import { AppService } from './google-auth.service';
import type { Response, Request } from 'express';
import { randomBytes } from 'crypto';
import { redis } from '../pool-Redis';
import crypto from 'crypto';
import type { Request as ExpressRequest } from 'express';
import { AuthGuard, RequirePlan } from '../guards/auth.guard';
import { pl } from 'zod/v4/locales';
import { stat } from 'fs';

interface RequestWithCookies extends ExpressRequest {
  cookies: { [key: string]: string }; // ou string | undefined se quiser mais seguro
}
//
@Controller('auth')
export class AppController {
  constructor(private readonly appService: AppService) {}
  // ((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((())))))))))))))
  // Rota de redirecionamento para o Google OAuth 2.0
  // **************************************************************************************
  @Get('google/redirect')
  async redirectToGoogle(@Res() res: Response, @Req() req: ExpressRequest) {
    const scope = process.env.GOOGLE_SCOPE;

    const state = randomBytes(16).toString('hex');

    // Pega o IP do usuário para armazenar junto com o estado
    const { truncatedIp } = this.appService.generateFingerprint(req);

    await redis.set(
      `oauth_state:${state}|${truncatedIp}`,
      'pending',
      'EX',
      300,
    );

    const url: string = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID!)}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI!)}&response_type=code&scope=${encodeURIComponent(scope!)}&access_type=${encodeURIComponent(process.env.GOOGLE_ACCESS_TYPE!)}&include_granted_scopes=${encodeURIComponent(process.env.GOOGLE_INCLUDE_GRANTED_SCOPES!)}&prompt=${encodeURIComponent(process.env.GOOGLE_PROMPT!)}&state=${encodeURIComponent(state)}`;

    return res.redirect(url);
  }
  // (((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((())))))))))))))
  // ROTA DE CALLBACK DO GOOGLE OAUTH 2.0
  // **************************************************************************************
  @Get('google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Res() res: Response,
    @Query('state') stateReturned: string,
    @Req() req: RequestWithCookies,
  ) {
    // Verificação de state/ truncated IP é o mesmo que foi enviado pelo redirect
    if (!code) return res.status(400).send('Code não recebido');
    const { truncatedIp } = this.appService.generateFingerprint(req);
    const stateValue = await redis.get(
      `oauth_state:${stateReturned}|${truncatedIp}`,
    );
    if (stateValue)
      await redis.del(`oauth_state:${stateReturned}|${truncatedIp}`);
    if (!stateValue) return res.status(400).send('Estado inválido ou já usado');

    // Apos validado que o mesmo usuario que solicitou o codigo está solicitando o token e que o codigo é valido, prossegue com a troca de tokens
    const payload = await this.appService.getTokens(code);
    // Armazena ou atualiza o usuário no banco de dados
    const user = await this.appService.storeUser(payload, 'google');
    // Gera a fingerprint do usuário, cria id de sessão, e verifica truncated ip
    const { fingerprint } = this.appService.generateFingerprint(req);
    const sessionId = crypto.randomBytes(32).toString('hex');
    // Dados são encriptados antes de serem enviados para o Redis para que não haja exposição no redis.
    if (!user.id) return res.status(500).send('Usuário sem id');
    if (!user.sub) return res.status(500).send('Usuário sem sub');
    const encryptedUserId = this.appService.encryptData(user.id);
    const encryptedSub = this.appService.encryptData(user.sub);
    // Cria a sessão no Redis com expiração de 1 hora
    await redis.set(
      `sess:${sessionId}`,
      JSON.stringify({
        userId: encryptedUserId,
        sub: encryptedSub,
        fingerprint,
        truncatedIp,
      }),
      'EX',
      3600,
    );
    // Envia o cookie de sessão para o cliente
    res.cookie('sesh', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 * 1000,
    });

    // verifica e retorna o plano atual do usuario
    const planoAtivo = await this.appService.getUserById(user.id, user.sub);
    if (!planoAtivo) {
      throw new Error('Usuário não encontrado no banco');
    }
    console.log('planoAtivo:', planoAtivo.status);
    const frontend: string = 'http://localhost:3001';
    const status = planoAtivo.status;
    if (status === true) {
      return res.redirect(`${frontend}/dashboard`);
    }
    if (status === false) {
      return res.redirect(`${frontend}/planos`);
    }
  }

  // ((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((())))))))))))))
  // ROTA PARA VERIFICAR SESSÃO DO USUARIO E REDIRECIONAR DE ACORDO (SE TEM PLANO ATIVO OU NÃO)
  // **************************************************************************************
  @Get('session')
  @UseGuards(AuthGuard)
  @RequirePlan()
  getSession(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    console.log(user);

    return res.redirect('/dashboard');
  }
}
