"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/session";
import { canManageUser, assignableRoles } from "@/lib/auth/roles";
import {
  notifyWelcome,
  notifyPasswordReset,
  notifyAccountChange,
} from "@/lib/email/notifications";
import { roleLabels } from "@/lib/validation/user";
import { createUserSchema, updateUserSchema, userIdSchema } from "@/lib/validation/user";

export type UserFormState = {
  values?: Record<string, string>;
  error?: string;
  fieldErrors?: Record<string, string>;
  // Mostrada UMA vez ao admin; nunca é guardada nem registada em logs
  // tempPassword só vem preenchida se o email NÃO seguiu (fallback manual)
  created?: { email: string; emailSent: boolean; tempPassword?: string };
};

// Sem caracteres ambíguos (0/O, 1/l/I). randomInt é criptograficamente seguro.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function generateTempPassword(length = 14) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function rawFrom(fd: FormData) {
  const g = (k: string) => String(fd.get(k) ?? "");
  return {
    email: g("email"),
    fullName: g("fullName"),
    role: g("role"),
    storeId: g("storeId"),
    departmentId: g("departmentId"),
    jobTitle: g("jobTitle"),
  };
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function createUser(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const me = await requirePermission("admin:manage");

  const raw = rawFrom(formData);
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { values: raw, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const d = parsed.data;

  // O gestor não cria administradores (esta rota usa a secret key, que ignora
  // o trigger da BD — por isso a regra tem de ser verificada aqui)
  if (!assignableRoles(me.role).includes(d.role)) {
    return { values: raw, fieldErrors: { role: "Não tens permissão para atribuir este perfil." } };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: tempPassword,
    email_confirm: true, // conta interna: sem passo de confirmação por email
    user_metadata: { full_name: d.fullName },
    // app_metadata só é editável pelo servidor (o utilizador não a consegue
    // limpar): obriga a trocar a password temporária no 1.º acesso (proxy.ts)
    app_metadata: { must_change_password: true },
  });

  if (error || !data.user) {
    if (error?.code === "email_exists") {
      return { values: raw, fieldErrors: { email: "Já existe um utilizador com este email." } };
    }
    console.error("[users] createUser falhou:", error?.code, error?.message);
    return { values: raw, error: "Não foi possível criar o utilizador." };
  }

  // O trigger handle_new_user já criou o perfil como COLLABORATOR; aqui
  // completamos. Contexto de confiança (secret key) permite mexer em campos protegidos.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: d.fullName,
      role: d.role,
      store_id: d.storeId,
      department_id: d.departmentId,
      job_title: d.jobTitle,
    })
    .eq("id", data.user.id);

  if (profileError) {
    // Sem perfil completo não deixamos uma conta a meio: desfaz a criação
    await admin.auth.admin.deleteUser(data.user.id);
    console.error("[users] perfil falhou, utilizador revertido:", profileError.code);
    return { values: raw, error: "Não foi possível criar o utilizador." };
  }

  // A password temporária segue por email para o próprio utilizador
  const sent = await notifyWelcome(d.email, d.fullName, tempPassword);

  revalidatePath("/admin/users");
  return {
    created: {
      email: d.email,
      emailSent: sent.ok,
      // Só mostramos no ecrã se o email falhou, para o admin a entregar à mão
      tempPassword: sent.ok ? undefined : tempPassword,
    },
  };
}

export async function updateUser(
  userId: string,
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const me = await requirePermission("admin:manage");

  const raw = rawFrom(formData);
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { values: raw, error: "Utilizador inválido." };

  const parsed = updateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { values: raw, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const d = parsed.data;

  // Evita perder o próprio acesso por engano (ou subir o próprio perfil)
  if (id.data === me.id && d.role !== me.role) {
    return { values: raw, fieldErrors: { role: "Não podes alterar o teu próprio perfil." } };
  }

  const supabase = await createClient();

  // O gestor não altera administradores nem atribui o perfil ADMIN
  const { data: target } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", id.data)
    .single();
  if (!target) return { values: raw, error: "Utilizador inválido." };
  if (!canManageUser(me.role, target.role) || !assignableRoles(me.role).includes(d.role)) {
    return { values: raw, error: "Não tens permissão para alterar este utilizador." };
  }

  // Cliente normal: o RLS + trigger (0012) são a barreira final
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: d.fullName,
      role: d.role,
      store_id: d.storeId,
      department_id: d.departmentId,
      job_title: d.jobTitle,
    })
    .eq("id", id.data);

  if (error) return { values: raw, error: "Não foi possível guardar as alterações." };

  if (target.role !== d.role) {
    await notifyAccountChange(
      target.email,
      d.fullName,
      `O teu perfil no HelpDesk passou a ${roleLabels[d.role]}.`
    );
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function toggleUserActive(userId: string, next: boolean) {
  const me = await requirePermission("admin:manage");
  const id = userIdSchema.safeParse(userId);
  if (!id.success) throw new Error("Utilizador inválido.");
  if (id.data === me.id && !next) throw new Error("Não podes desativar a tua própria conta.");

  // Não apagamos utilizadores (histórico de tickets). Inativo = requireUser
  // termina a sessão no pedido seguinte e o login é recusado.
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", id.data)
    .single();
  if (!target || !canManageUser(me.role, target.role)) {
    throw new Error("Não tens permissão para alterar este utilizador.");
  }
  const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", id.data);
  if (error) throw new Error("Não foi possível atualizar o utilizador.");

  await notifyAccountChange(
    target.email,
    target.full_name,
    next
      ? "A tua conta no HelpDesk foi reativada. Já podes entrar."
      : "A tua conta no HelpDesk foi desativada. Se achas que é um engano, contacta o IT."
  );
  revalidatePath("/admin/users");
}

export type ResetResult =
  | { ok: true; emailSent: boolean; tempPassword?: string }
  | { ok: false; error: string };

// O IT redefine a password de alguém (esquecimento): gera uma temporária,
// obriga a trocá-la no próximo acesso e envia-a por email.
export async function resetUserPassword(userId: string): Promise<ResetResult> {
  const me = await requirePermission("admin:manage");
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Utilizador inválido." };
  if (id.data === me.id) {
    return { ok: false, error: "Para a tua conta usa “Alterar password”." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role, email, full_name, is_active")
    .eq("id", id.data)
    .single();
  if (!target || !canManageUser(me.role, target.role)) {
    return { ok: false, error: "Não tens permissão para alterar este utilizador." };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id.data, {
    password: tempPassword,
    app_metadata: { must_change_password: true },
  });
  if (error) {
    console.error("[users] reset password falhou:", error.code);
    return { ok: false, error: "Não foi possível redefinir a password." };
  }

  const sent = await notifyPasswordReset(target.email, target.full_name, tempPassword);
  return { ok: true, emailSent: sent.ok, tempPassword: sent.ok ? undefined : tempPassword };
}