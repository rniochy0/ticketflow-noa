import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(2, "O nome deve ter pelo menos 2 caracteres")
  .max(100, "O nome não pode passar de 100 caracteres");

export const categorySchema = z.object({ name });

export const renameCategorySchema = z.object({
  id: z.uuid("Categoria inválida"),
  name,
});

export const subcategorySchema = z.object({
  categoryId: z.uuid("Categoria inválida"),
  name,
});

export const renameSubcategorySchema = z.object({
  id: z.uuid("Subcategoria inválida"),
  name,
});

export const toggleSchema = z.object({
  id: z.uuid("Identificador inválido"),
  next: z.boolean(),
});