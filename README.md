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

Como Rodar Localmente
1. Instalar dependencias
npm install
2. Configurar variaveis de ambiente
Crie um arquivo .env na raiz do projeto com as variaveis necessarias:

PORT=10000
NODE_ENV=development

RDS_HOST=
RDS_PORT=5432
RDS_USER=
RDS_PASSWORD=
RDS_DB=
RDS_SSL_CA=

REDIS_HOST=
REDIS_PORT=6379
REDIS_SECRET_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_SCOPE=
GOOGLE_ACCESS_TYPE=
GOOGLE_INCLUDE_GRANTED_SCOPES=
GOOGLE_PROMPT=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_BASIC=
STRIPE_PRICE_PRO=
STRIPE_PAYMENT_METHOD_COLLECTION=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
A variável REDIS_SECRET_KEY deve ser uma chave hexadecimal compatível com AES-256-GCM, ou seja, 32 bytes em hexadecimal.

3. Executar em desenvolvimento
npm run start:dev
4. Build de producao
npm run build
npm run start:prod
Banco de Dados
O projeto usa PostgreSQL com TypeORM.

A conexão é configurada em AppModule usando variáveis RDS_*.

Entidades principais:

tenant_user
Armazena usuários autenticados via provedor externo.

Campos principais:

id
provider
providerId
email
name
avatarUrl
status
plano
billingCycleEnd
stripe_orders
Armazena registros relacionados a pagamentos e assinaturas do Stripe.

Campos principais:

checkoutSessionId
userId
subscriptionId
invoiceId
amountTotal
currency
currentPeriodEnd
paymentStatus
Autenticacao com Google
O fluxo de autenticação começa na rota:

GET /auth/google/redirect
Essa rota gera um state, salva temporariamente no Redis e redireciona o usuário para o consentimento do Google.

Após o login, o Google redireciona para:

GET /auth/google/callback
No callback, a API:

Valida o state recebido.
Troca o code por tokens no Google.
Valida o id_token.
Cria ou atualiza o usuário no banco.
Cria uma sessão no Redis.
Envia um cookie sesh HTTP-only para o navegador.
Redireciona o usuário conforme o status do plano.
Sessao e Protecao de Rotas
As sessões são armazenadas no Redis com expiração de 1 hora.

O cookie usado pela aplicação é:

sesh
Rotas protegidas usam o AuthGuard, que:

Verifica se o cookie de sessão existe.
Busca a sessão no Redis.
Decripta os dados sensíveis.
Busca o usuário no banco.
Injeta os dados do usuário no objeto request.
Bloqueia rotas que exigem plano ativo quando o usuário não possui assinatura.
Para exigir plano ativo em uma rota, use o decorator:

@RequirePlan()
Rotas
Geral
GET /
Retorna uma mensagem simples de status da API.

Google OAuth
GET /auth/google/redirect
Inicia o login com Google.

GET /auth/google/callback
Recebe o retorno do Google OAuth.

GET /auth/session
Verifica a sessão do usuário. Requer autenticação e plano ativo.

Stripe
POST /stripe/checkout-session
Cria uma sessão de checkout no Stripe.

Requer autenticação.

Body:

{
  "plan": "basic"
}
Planos aceitos:

basic
pro
Resposta:

{
  "url": "https://checkout.stripe.com/..."
}
POST /stripe/webhook
Recebe eventos do Stripe e processa mudanças de pagamento e assinatura.

Eventos tratados:

checkout.session.completed
invoice.payment_succeeded
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
GET /stripe/success
Rota de retorno para pagamento iniciado com sucesso.

GET /stripe/cancel
Rota de retorno para pagamento cancelado.

Scripts
npm run start
Executa a aplicação.

npm run start:dev
Executa em modo desenvolvimento com watch.

npm run build
Gera o build da aplicação.

npm run start:prod
Executa a aplicação a partir da pasta dist.

npm run test
Executa testes unitários.

npm run test:e2e
Executa testes end-to-end.

npm run test:cov
Gera relatório de cobertura dos testes.

npm run lint
Executa ESLint e aplica correções automáticas.

npm run format
Formata arquivos TypeScript com Prettier.

Segurança
O projeto utiliza algumas medidas importantes de segurança:

Cookie de sessão com httpOnly
Cookie seguro em produção
Sessões com expiração no Redis
Criptografia AES-256-GCM para dados sensíveis da sessão
Validação de token Google via JWKS
Validação de assinatura dos webhooks do Stripe
Rate limiting global
CORS configurado para origem específica
Cache desabilitado em respostas de rotas protegidas
Observacoes de Deploy
A aplicação escuta na porta definida por PORT. Caso a variável não exista, usa 10000.

process.env.PORT ?? 10000
Em produção, a aplicação usa 0.0.0.0, permitindo execução em plataformas como Render, Railway, Fly.io ou servidores próprios.

Para webhooks do Stripe em produção, configure a URL pública:

POST https://sua-api.com/stripe/webhook
No painel do Stripe, use o segredo gerado no endpoint de webhook como valor de:

STRIPE_WEBHOOK_SECRET=
Testes
O projeto usa Jest como test runner.

A configuração principal está no package.json, com testes buscando arquivos no padrão:

*.spec.ts
Licenca
Projeto privado/educacional sem licença pública definida.
```
