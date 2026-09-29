// Fonte única de verdade das permissões da aplicação.
// Tem de reflectir as regras do RLS na base de dados (0001/0002):
// - MANAGER consulta tudo mas não atende tickets
// - ADMIN gere lojas, categorias e técnicos

export const ROLES = ["COLLABORATOR", "TECHNICIAN", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  "ticket:create": ["COLLABORATOR", "TECHNICIAN", "MANAGER", "ADMIN"],
  "ticket:view_all": ["TECHNICIAN", "MANAGER", "ADMIN"],
  "ticket:handle": ["TECHNICIAN", "ADMIN"],
  "dashboard:view": ["TECHNICIAN", "MANAGER", "ADMIN"],
  "admin:manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}