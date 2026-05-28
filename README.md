# Backend - Autenticacao, Sessoes e Pagamentos

API backend desenvolvida com NestJS para autenticação via Google OAuth 2.0, controle de sessão com Redis, persistência em PostgreSQL e integração com Stripe para checkout de planos por assinatura.

## Tecnologias

- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- Redis
- Google OAuth 2.0
- Stripe
- Zod
- Class Validator
- Jest

## Funcionalidades

- Login com Google OAuth 2.0
- Validação do token retornado pelo Google
- Criação e atualização de usuários no banco de dados
- Sessão persistida em Redis com cookie HTTP-only
- Criptografia de dados sensíveis armazenados na sessão
- Proteção de rotas com AuthGuard
- Verificação de plano ativo do usuário
- Criação de sessão de checkout no Stripe
- Recebimento de webhooks do Stripe
- Registro de pedidos de pagamento no banco
- Rate limiting global com NestJS Throttler

## Estrutura Geral

```text
src/
├── GoogleOAuth/
│   ├── google-auth.controller.ts
│   ├── google-auth.service.ts
│   ├── google-auth.module.ts
│   └── types/
├── guards/
│   └── auth.guard.ts
├── stripe-payment/
│   ├── stripe-payment.controller.ts
│   ├── stripe-payment.service.ts
│   ├── stripe-payment.module.ts
│   ├── dto/
│   └── entities/
├── entities/
│   └── tenant-user.entity.ts
├── app.module.ts
├── main.ts
└── pool-Redis.ts
