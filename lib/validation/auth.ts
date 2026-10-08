import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email inválido").max(254),
  password: z.string().min(1, "Introduz a password").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;