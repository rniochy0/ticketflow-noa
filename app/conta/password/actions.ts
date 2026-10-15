"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { notifyPasswordChanged } from "@/lib/email/notifications";
import { changePasswordSchema } from "@/lib/validation/user";

export type PasswordState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function changePassword(
  _prev: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }

  const supabase = await createClient();

  // Reconfirma a password atual: uma sessão esquecida aberta não chega para a trocar
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (authError) return { fieldErrors: { currentPassword: "Password atual incorreta." } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { error: "Não foi possível alterar a password. Tenta novamente." };

  // Limpa a obrigação de trocar a password (só o servidor o consegue fazer)
  const { error: flagError } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  });
  if (flagError) console.error("[password] não limpou must_change_password:", flagError.code);

  // Alerta de segurança para o próprio utilizador
  await notifyPasswordChanged(user.email, user.fullName);

  return { ok: true };
}