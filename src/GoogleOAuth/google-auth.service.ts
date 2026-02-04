import { Injectable } from '@nestjs/common';
import { GoogleTokensSchema, storeUserSchema } from './types/types';
import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantUser } from '../entities/tenant-user.entity';
import type { Request as ExpressRequest } from 'express';
import crypto from 'crypto';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(TenantUser)
    private readonly tenantUserRepo: Repository<TenantUser>,
  ) {}
  // FUNÇÃO PARA TROCA DE TOKENS, ESSA FUNÇÃO CHAMA O METODO PARA VALIDAR O ID TOKEN
  async getTokens(code: string): Promise<JWTPayload> {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        throw new Error(`Failed ao trocar tokens: ${text}`);
      }
      const tokens = GoogleTokensSchema.parse(await tokenResponse.json());

      // Verifica a autenticidade do Token
      const JWKS = createRemoteJWKSet(
        new URL('https://www.googleapis.com/oauth2/v3/certs'),
      );

      const { payload } = await jwtVerify(tokens.id_token, JWKS, {
        audience: process.env.GOOGLE_CLIENT_ID!,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      });
      if (!payload || !payload.sub) {
        throw new Error('Payload inválido');
      }
      return payload;
    } catch (error) {
      console.error('Erro no getTokens:', error);
      throw new Error('Não foi possível autenticar com o Google');
    }
  }
  // FUNÇÃO PARA VERIFICAR E ARMAZENAR O USUÁRIO NO BANCO DE DADOS
  async storeUser(payload: JWTPayload, provider: string) {
    const parsed = storeUserSchema.parse({ payload });
    const { sub, email, name, picture } = parsed.payload as {
      sub: string;
      email: string | null;
      name: string | null;
      picture: string | null;
    };

    let user = await this.tenantUserRepo.findOne({
      where: { provider, providerId: sub },
    });

    if (!user) {
      user = this.tenantUserRepo.create({
        provider,
        providerId: sub,
        email,
        name,
        avatarUrl: picture,
      });
      await this.tenantUserRepo.save(user);
    } else {
      user.name = name;
      user.avatarUrl = picture;
      await this.tenantUserRepo.save(user);
    }
    return { id: user.id, sub };
  }

  // Função para encriptar dados sensíveis (UserId e Chave fixa (id)) antes de armazenar no Redis
  encryptData(data: string): string {
    const ENCRYPTION_KEY = Buffer.from(process.env.REDIS_SECRET_KEY!, 'hex'); // 32 bytes
    const IV_LENGTH = 16;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }
  // Função para decriptar dados sensíveis ao recuperar do Redis
  decryptData(encrypted: string): string {
    const ENCRYPTION_KEY = Buffer.from(process.env.REDIS_SECRET_KEY!, 'hex');
    const bData = Buffer.from(encrypted, 'base64');
    const iv = bData.slice(0, 16);
    const tag = bData.slice(16, 32);
    const text = bData.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(text, undefined, 'utf8') + decipher.final('utf8');
  }

  // Função para gerar fingerprint simples + truncar IP
  generateFingerprint(req: ExpressRequest): {
    fingerprint: string;
    truncatedIp: string;
  } {
    const ua = req.headers['user-agent'] ?? '';
    const lang = req.headers['accept-language'] ?? '';

    let ip = req.ip || '';
    if (req.headers['x-forwarded-for']) {
      ip = (req.headers['x-forwarded-for'] as string).split(',')[0].trim();
    }

    const truncatedIp = ip.includes(':')
      ? ip.split(':').slice(0, 4).join(':')
      : ip.split('.').slice(0, 2).join('.');

    const data = `${ua}|${lang}|${truncatedIp}`;
    const fingerprint = crypto.createHash('sha256').update(data).digest('hex');

    return { fingerprint, truncatedIp };
  }
  // Função para verificar estado do plano do user após login
  async getUserById(userId: string, providerId: string) {
    // busca o usuário no banco
    const user = await this.tenantUserRepo.findOne({
      where: { id: userId, providerId: providerId },
      select: [
        'id',
        'plano',
        'status',
        'email',
        'name',
        'avatarUrl',
        'providerId',
      ], // pega só o que interessa
    });

    if (!user) {
      return;
    }

    return {
      id: user.id,
      plano: user.plano,
      status: user.status,
      providerId: user.providerId,
      email: user.email,
      name: user.name,
      picture: user.avatarUrl,
    };
  }
}
