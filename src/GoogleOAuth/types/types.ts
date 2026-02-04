import { z } from 'zod';

// Schema para validar a resposta dos tokens do Google OAuth 2.0
export const GoogleTokensSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string(),
  id_token: z.string(),
  token_type: z.string(),
});

// Schema para validar type do regis
export const SessionDataSchema = z.object({
  userId: z.string(),
  sub: z.string(),
  fingerprint: z.string(),
  truncatedIp: z.string(),
});
// Esquema validando apenas sub
export const storeUserSchema = z.object({
  payload: z.object({
    sub: z.string().min(1),
  }),
});
// Schema para validar o user passado para checkout
export type UserForCheckout = { id: string; hasPlan: boolean };
