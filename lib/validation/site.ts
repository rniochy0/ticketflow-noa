import { z } from "zod";

export const SITE_TYPES = ["STORE", "HQ", "LOGISTICS", "OTHER"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const siteTypeLabels: Record<SiteType, string> = {
  STORE: "Loja",
  HQ: "Sede",
  LOGISTICS: "Logística",
  OTHER: "Outro",
};

export const siteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "O código deve ter pelo menos 2 caracteres")
    .max(20, "O código não pode passar de 20 caracteres"),
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres")
    .max(100, "O nome não pode passar de 100 caracteres"),
  type: z.enum(SITE_TYPES),
});

export type SiteInput = z.infer<typeof siteSchema>;