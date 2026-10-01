import { z } from "zod";

// uuid() valida o formato antes de a query sequer chegar à BD:
// entrada disparatada nunca gera SQL, é rejeitada aqui.
export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "O título deve ter pelo menos 3 caracteres")
    .max(150, "O título não pode passar de 150 caracteres"),
  description: z
    .string()
    .trim()
    .min(5, "Descreve o problema com um pouco mais de detalhe")
    .max(5000, "A descrição não pode passar de 5000 caracteres"),
  categoryId: z.uuid("Categoria inválida"),
  subcategoryId: z.uuid("Subcategoria inválida").optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const assignTicketSchema = z.object({
  ticketId: z.uuid(),
  technicianId: z.uuid(),
});

export const changeStatusSchema = z.object({
  ticketId: z.uuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]),
});

export const changePrioritySchema = z.object({
  ticketId: z.uuid(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});

export const addMessageSchema = z.object({
  ticketId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Escreve uma mensagem")
    .max(5000, "A mensagem não pode passar de 5000 caracteres"),
});