"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/session";
import { createUserSchema, updateUserSchema, userIdSchema } from "@/lib/validation/user";

export type UserFormState = {
  values?: Record<string, string>;
  error?: string;
  fieldErrors?: Record<string, string>;
  // Mostrada UMA vez ao admin; nunca é guardada nem registada em logs
  created?: { email: string; tempPassword: string };
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
  await requirePermission("admin:manage");

  const raw = rawFrom(formData);
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { values: raw, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: tempPassword,
    email_confirm: true, // conta interna: sem passo de confirmação por email
    user_metadata: { full_name: d.fullName },
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

  revalidatePath("/admin/users");
  return { created: { email: d.email, tempPassword } };
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

  // Evita o admin perder o próprio acesso por engano
  if (id.data === me.id && d.role !== "ADMIN") {
    return { values: raw, fieldErrors: { role: "Não podes retirar o teu próprio perfil de administrador." } };
  }

  // Cliente normal: o RLS + trigger só deixam um ADMIN alterar estes campos
  const supabase = await createClient();
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
  const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", id.data);
  if (error) throw new Error("Não foi possível atualizar o utilizador.");
  revalidatePath("/admin/users");
}