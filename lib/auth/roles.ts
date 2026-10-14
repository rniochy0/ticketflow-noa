// Fonte única de verdade das permissões da aplicação.
// Tem de reflectir as regras do RLS na base de dados (0001/0002):
// - MANAGER tem os mesmos privilégios do ADMIN (gere tickets, sites,
//   categorias e utilizadores) — migração 0011
// - TECHNICIAN atende tickets

export const ROLES = ["COLLABORATOR", "TECHNICIAN", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "ticket:create": ["COLLABORATOR", "TECHNICIAN", "MANAGER", "ADMIN"],
  "ticket:view_all": ["TECHNICIAN", "MANAGER", "ADMIN"],
  "ticket:handle": ["TECHNICIAN", "MANAGER", "ADMIN"],
  "dashboard:view": ["TECHNICIAN", "MANAGER", "ADMIN"],
  "admin:manage": ["MANAGER", "ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

// Quem pode gerir contas de quem. O GESTOR gere todos menos administradores
// e não pode atribuir o perfil ADMIN (também reforçado na BD, migração 0012).
export function canManageUser(actor: Role, target: Role): boolean {
  if (actor === "ADMIN") return true;
  if (actor === "MANAGER") return target !== "ADMIN";
  return false;
}

export function assignableRoles(actor: Role): readonly Role[] {
  return actor === "ADMIN" ? ROLES : ROLES.filter((r) => r !== "ADMIN");
}