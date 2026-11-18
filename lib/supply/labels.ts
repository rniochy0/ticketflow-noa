export const supplyStatusLabels = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
} as const;

export type SupplyStatus = keyof typeof supplyStatusLabels;

export const SUPPLY_STATUSES = Object.keys(supplyStatusLabels) as SupplyStatus[];

export function isSupplyStatus(v: unknown): v is SupplyStatus {
  return typeof v === "string" && (SUPPLY_STATUSES as string[]).includes(v);
}

export const supplyKindLabels = {
  TONER: "Toner",
  PERIFERICO: "Periféricos",
  MONITOR: "Monitores",
  OUTRO: "Outros",
} as const;

export type SupplyKind = keyof typeof supplyKindLabels;
export const SUPPLY_KINDS = Object.keys(supplyKindLabels) as SupplyKind[];
