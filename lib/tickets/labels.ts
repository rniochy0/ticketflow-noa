import type { TicketStatus } from "@/components/ui/Badge";

// Rótulos no plural, para contadores/KPIs ("12 Abertos").
// Os singulares (para badges) vivem em components/ui/Badge.tsx.
export const statusPluralLabels: Record<TicketStatus, string> = {
  OPEN: "Abertos",
  IN_PROGRESS: "Em atendimento",
  WAITING_USER: "Aguardando",
  RESOLVED: "Resolvidos",
  CLOSED: "Fechados",
};
