export const theme = {
  colors: {
    primary: "#0a6cff",
    primaryHover: "#0857cc",
    background: "#f6f7f9",
    surface: "#ffffff",
    border: "#e2e5ea",
    text: "#171717",
    textMuted: "#6b7280",
    success: "#16a34a",
    warning: "#d97706",
    danger: "#dc2626",
    // Um par (texto, fundo) por estado do ticket, para os Badges
    status: {
      OPEN: { fg: "#1d4ed8", bg: "#dbeafe" },
      IN_PROGRESS: { fg: "#b45309", bg: "#fef3c7" },
      WAITING_USER: { fg: "#7c3aed", bg: "#ede9fe" },
      RESOLVED: { fg: "#15803d", bg: "#dcfce7" },
      CLOSED: { fg: "#4b5563", bg: "#e5e7eb" },
    },
  },
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.25rem",
    xl: "1.5rem",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  radius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
  },
  // Mobile-first: os colaboradores de loja usam sobretudo o telemóvel
  breakpoints: {
    tablet: "768px",
    desktop: "1024px",
  },
} as const;

export type AppTheme = typeof theme;