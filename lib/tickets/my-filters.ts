import { sanitizeSearch } from "@/lib/validation/search";

export const STATUS_VALUES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
] as const;

export type MyStatus = (typeof STATUS_VALUES)[number];

export type MyTicketsFilters = {
  q: string;
  status?: MyStatus;
  sort: "newest" | "oldest";
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Só aceita datas reais no formato YYYY-MM-DD (ex.: rejeita 2026-02-31)
function validDate(v: string | undefined): string | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return undefined;
  return v;
}

// Tudo o que vem da URL é tratado como não confiável: listas fechadas para
// enums, regex + round-trip para datas, sanitizeSearch para texto livre.
export function parseMyTicketsFilters(sp: RawParams): MyTicketsFilters {
  const status = first(sp.status);
  return {
    q: sanitizeSearch(first(sp.q), 80),
    status: (STATUS_VALUES as readonly string[]).includes(status ?? "")
      ? (status as MyStatus)
      : undefined,
    sort: first(sp.sort) === "oldest" ? "oldest" : "newest",
    from: validDate(first(sp.from)),
    to: validDate(first(sp.to)),
  };
}

// Angola e Portugal (inverno) usam UTC+1; os dias de filtro são em hora local
export function dayStartIso(day: string): string {
  return `${day}T00:00:00+01:00`;
}

export function nextDayStartIso(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dayStartIso(d.toISOString().slice(0, 10));
}

export function filtersToQuery(f: MyTicketsFilters): string {
  const qs = new URLSearchParams();
  if (f.q) qs.set("q", f.q);
  if (f.status) qs.set("status", f.status);
  if (f.sort !== "newest") qs.set("sort", f.sort);
  if (f.from) qs.set("from", f.from);
  if (f.to) qs.set("to", f.to);
  return qs.toString();
}

export function hasActiveFilters(f: MyTicketsFilters): boolean {
  return !!(f.q || f.status || f.from || f.to || f.sort !== "newest");
}