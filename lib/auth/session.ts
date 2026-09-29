import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, isRole, type Permission, type Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

type SessionResult =
  | { status: "anonymous" }
  | { status: "inactive" }
  | { status: "ok"; user: SessionUser };

// cache(): várias chamadas no mesmo pedido fazem uma única ida à BD
const getSession = cache(async (): Promise<SessionResult> => {
  const supabase = await createClient();

  // getUser() valida o token no servidor Supabase (getSession() não serve)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || !isRole(profile.role)) {
    return { status: "inactive" };
  }

  return {
    status: "ok",
    user: {
      id: user.id,
      email: user.email ?? "",
      fullName: profile.full_name ?? "",
      role: profile.role,
    },
  };
});

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (session.status === "anonymous") redirect("/login");
  // Conta desactivada ou sem perfil: termina a sessão (evita ciclo de redirects)
  if (session.status === "inactive") redirect("/auth/end-session");
  return session.user;
}

export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/acesso-negado");
  return user;
}
