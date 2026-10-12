/** import "server-only";
import { Resend } from "resend";

// Sem API key definida (ex: ambiente de desenvolvimento sem conta Resend),
// os emails são só registados na consola em vez de falhar o build/o pedido.
const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM = process.env.EMAIL_FROM || "NOA HelpDesk <onboarding@resend.dev>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"; **/

import "server-only";
import { Resend } from "resend";

// Sem API key definida (ex: ambiente de desenvolvimento sem conta Resend),
// os emails são só registados na consola em vez de falhar o build/o pedido.
const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM = process.env.EMAIL_FROM || "NOA HelpDesk <onboarding@resend.dev>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// SÓ para desenvolvimento: com o sandbox do Resend (sem domínio verificado)
// só é possível enviar para o email do dono da conta. Definindo
// EMAIL_DEV_REDIRECT=o-teu-email, TODOS os emails são desviados para lá.
// Ignorado em produção, para nunca desviar emails reais por engano.
export const EMAIL_DEV_REDIRECT =
  process.env.NODE_ENV !== "production" ? process.env.EMAIL_DEV_REDIRECT || null : null;
