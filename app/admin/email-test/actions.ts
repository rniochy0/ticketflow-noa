"use server";

import { requirePermission } from "@/lib/auth/session";
import { sendTestEmail } from "@/lib/email/notifications";

export type TestEmailState = { ok?: boolean; message?: string };

// Só ADMIN, e sempre para o email do próprio admin (nunca um endereço livre).
export async function sendTest(): Promise<TestEmailState> {
  const user = await requirePermission("admin:manage");
  const r = await sendTestEmail(user.email);
  return r.ok
    ? { ok: true, message: `Enviado para ${user.email}. Verifica a caixa (e o spam).` }
    : { ok: false, message: r.error };
}