import type { NextResponse } from "next/server";
import { embedOrigins } from "@/lib/supabase/cookie-options";

const isDev = process.env.NODE_ENV !== "production";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "*.supabase.co";

// frame-ancestors: só as origens da lista (ou nenhuma). Sem lista = não embutível.
const frameAncestors = embedOrigins.length > 0 ? embedOrigins.join(" ") : "'none'";

// 'unsafe-inline' necessário hoje (Next injeta scripts inline; styled-components
// injeta <style>). 'unsafe-eval' só em desenvolvimento.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // /api/attachments/:id redireciona para um URL assinado do Supabase Storage
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}${isDev ? " ws://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Aplicado no proxy.ts a todas as respostas (não precisa de next.config.ts)
export function withSecurityHeaders<T extends NextResponse>(res: T): T {
  res.headers.set("Content-Security-Policy", csp);
  // X-Frame-Options não suporta listas: só o enviamos quando NÃO há embutimento
  if (embedOrigins.length === 0) res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  if (!isDev) {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return res;
}