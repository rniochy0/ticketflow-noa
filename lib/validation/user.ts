import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";

export const roleLabels: Record<(typeof ROLES)[number], string> = {
  COLLABORATOR: "Colaborador",
  TECHNICIAN: "Técnico de IT",
  MANAGER: "Gestor",
  ADMIN: "Administrador",
};

const optionalUuid = z
  .union([z.uuid("Valor inválido"), z.literal("")])
  .transform((v) => v || null);

const base = {
  fullName: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres")
    .max(120, "O nome não pode passar de 120 caracteres"),
  role: z.enum(ROLES, "Perfil inválido"),
  storeId: optionalUuid,
  departmentId: optionalUuid,
  jobTitle: z
    .string()
    .trim()
    .max(100, "A função não pode passar de 100 caracteres")
    .transform((v) => v || null),
};

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email inválido")),
  ...base,
});

export const updateUserSchema = z.object(base);

export const userIdSchema = z.uuid("Utilizador inválido");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Indica a password atual"),
    newPassword: z
      .string()
      .min(10, "A nova password deve ter pelo menos 10 caracteres")
      .max(72, "A nova password não pode passar de 72 caracteres")
      .regex(/[A-Za-z]/, "Inclui pelo menos uma letra")
      .regex(/\d/, "Inclui pelo menos um número"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "As passwords não coincidem",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "A nova password deve ser diferente da atual",
  });