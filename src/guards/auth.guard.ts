import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { redis } from '../pool-Redis';
import { SessionDataSchema } from '../GoogleOAuth/types/types';
import { AppService } from '../GoogleOAuth/google-auth.service';
import { Reflector } from '@nestjs/core';

interface RequestWithSession extends Request {
  cookies: Record<string, string>; // cookies parseados como string
  user?: {
    id: string;
    sub: string;
  };
}

export const RequirePlan = () => SetMetadata('requirePlan', true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly appService: AppService,
    private readonly reflector: Reflector,
  ) {}
  // MÉTODO PARA VERIFICAR A AUTENTICAÇÃO DO USUÁRIO ATRAVÉS DA SESSÃO
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Pega o objeto de request e response e transforma em HTTP
    const req: Request = context
      .switchToHttp()
      .getRequest<RequestWithSession>();
    const res: Response = context.switchToHttp().getResponse();
    // Verifica se a rota exige plano ativo/ decorator
    const RequirePlan = this.reflector.get<boolean>(
      'requirePlan',
      context.getHandler(),
    );

    const link = 'http://localhost:3001';
    // Verifica se o cookie de sessão existe
    // Se não existir ou bugar redireciona o user para a pagina que refaz o cookie
    try {
      const existingSessionId = req.cookies?.['sesh'];
      if (!existingSessionId) {
        res.status(401).json({
          code: 'NO_SESSION',
          message: 'Cookie de sessão ausente',
        });
        return false;
      }
      const ttl = await redis.ttl(`sess:${existingSessionId}`);
      console.log('Session TTL (seconds):', ttl);
      // Verifica se a sessão do usuario é real de acordo com o redis
      // Mesma coisa, redireciona para refazer o cookie se não existir
      const sessionData = await redis.get(`sess:${existingSessionId}`);
      if (!sessionData) {
        res.status(401).json({
          code: 'NO_SESSION',
          message: 'Sessão inválida ou expirada',
        });
        return false;
      }
      // Decriptografa a chave fixa e o sub do user para uso posterior
      const { userId, sub } = SessionDataSchema.parse(JSON.parse(sessionData));
      const decryptedUserId = this.appService.decryptData(userId);
      const decryptedSub = this.appService.decryptData(sub);

      console.log('decryptedUserId:', decryptedUserId);
      console.log('decryptedSub:', decryptedSub);
      // Utiliza os dados descriptografados para buscar o usuário no banco de dados (parametros: userId e sub)
      const foundUser = await this.appService.getUserById(
        decryptedUserId,
        decryptedSub,
      );
      console.log('foundUser:', foundUser);
      // Verifica se o usuário existe
      console.log('Session TTL (seconds):', ttl);

      if (!foundUser) {
        res.status(403).json({
          code: 'USER_INACTIVE',
          message: 'Usuário precisa completar cadastro',
        });
        return false;
      }
      // Verifica se o user tem plano ativo
      // A LOGICA DE REDIRECIONAMENTO É INCLUSA AQUI POIS NÃO ACHEI OUTRA FORMA DE INCLUIR UMA UX AONDE O USARIO QUE NÃO TEM O PLANO
      // SEMPRE SEJA REDIRECIONADO PARA A PAGINA DE CALL TO ACTION
      // DE FORMA QUE SE O USUARIO TIVER STATUS FALSE E AQUI RETORNASSE FALSE, O NEST NÃO DEIXA A ROTA SER ACESSADA
      // CHANCE DE ALGUNS BUGS PORÉM É UM BOM PREÇO A SE PAGAR PARA TER UMA BOA UX QUE SEMPRE APRESENTA CTA
      if (foundUser.status !== true) {
        if (RequirePlan) {
          // Rota exige plano → bloqueia
          res.status(403).json({
            code: 'USER_HAS_NO_PLAN',
            message:
              'Usuário precisa comprar um plano, esta rota exige plano ativo',
            redirect: `${link}/planos`,
          });
          return false;
        }
      }

      // Selo de autenticação bem-sucedida. Altera o objeto de req para incluir o user id e sub.
      (req as any).user = {
        id: decryptedUserId,
        sub: decryptedSub,
        hasPlan: foundUser.status,
      };
      // Remove o cache das respostas para proteger dados sensiveis ou seja, endpoints protegidos pelo guard não serão cacheados
      res.set({
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
      });
      return true;
      // Garantir que nenhuma rota rode se houver erro no guard
    } catch (err) {
      console.error('Erro no AuthGuard:', err);
      res.status(500).send('Erro interno de autenticação');
      return false;
    }
  }
}
