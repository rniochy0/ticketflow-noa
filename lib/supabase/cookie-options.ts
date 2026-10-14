// Embutir a app noutro site (ex: intranet/SharePoint da NOA) exige cookies de
// sessão SameSite=None; Secure, senão o browser não os envia dentro do iframe.
//
// Só ativa quando NEXT_PUBLIC_EMBED_ORIGINS tem pelo menos uma origem válida
// (a mesma lista que o CSP frame-ancestors usa em lib/security/headers.ts).
// Sem a variável, os cookies ficam no padrão seguro (SameSite=Lax).
//
// Origens aceites: https://host[:porta], sem caminho nem wildcards.
// Em desenvolvimento aceita também http://localhost[:porta].
const ORIGIN_RE = /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;
const DEV_ORIGIN_RE = /^http:\/\/localhost(:\d{1,5})?$/i;

export function parseEmbedOrigins(raw: string | undefined): string[] {
  const dev = process.env.NODE_ENV !== "production";
  return (raw ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((o) => ORIGIN_RE.test(o) || (dev && DEV_ORIGIN_RE.test(o)));
}

export const embedOrigins = parseEmbedOrigins(process.env.NEXT_PUBLIC_EMBED_ORIGINS);

export const embedCookieOptions =
  embedOrigins.length > 0 ? { sameSite: "none" as const, secure: true } : undefined;