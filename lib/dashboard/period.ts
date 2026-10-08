export const PERIODS = ["today", "7d", "30d"] as const;
export type Period = (typeof PERIODS)[number];

export const periodLabels: Record<Period, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
};

export function parsePeriod(value: string | undefined): Period {
  return (PERIODS as readonly string[]).includes(value ?? "")
    ? (value as Period)
    : "7d";
}

// Luanda é UTC+1 o ano todo (sem horário de verão). O servidor corre em UTC,
// por isso "hoje" tem de ser calculado a partir da meia-noite de Luanda —
// senão, durante 1 hora por dia, "Hoje" mostraria o dia errado.
const LUANDA_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "7 dias" e "30 dias" são dias de calendário incluindo hoje
// (hoje + 6 anteriores, hoje + 29 anteriores).
export function periodStart(period: Period, now = new Date()): Date {
  const local = new Date(now.getTime() + LUANDA_OFFSET_MS);
  const localMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  );
  const daysBack = period === "today" ? 0 : period === "7d" ? 6 : 29;
  return new Date(localMidnight - daysBack * DAY_MS - LUANDA_OFFSET_MS);
}
