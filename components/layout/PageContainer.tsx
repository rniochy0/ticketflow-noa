"use client";

import styled from "styled-components";

type Size = "sm" | "md" | "lg";

// Larguras usadas em toda a app: formularios (sm), paginas de conteudo (md), tabelas/dashboards (lg)
const maxWidths: Record<Size, string> = {
  sm: "480px",
  md: "640px",
  lg: "960px",
};

export const PageContainer = styled.main<{ $size?: Size }>`
  max-width: ${({ $size = "md" }) => maxWidths[$size]};
  margin: ${({ theme }) => theme.spacing.xl} auto;
  padding: 0 ${({ theme }) => theme.spacing.md};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const PageTitle = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.xl};
`;
