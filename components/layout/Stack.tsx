"use client";

import styled from "styled-components";

// Empilhamento vertical com espaçamento do theme
export const Stack = styled.div<{ $gap?: "xs" | "sm" | "md" | "lg" }>`
  display: grid;
  gap: ${({ theme, $gap = "sm" }) => theme.spacing[$gap]};
`;

// Linha horizontal (navegação, grupos de botões)
export const Inline = styled.div<{ $gap?: "xs" | "sm" | "md" | "lg" }>`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme, $gap = "sm" }) => theme.spacing[$gap]};
`;

// Grelha responsiva para cartões (dashboard de KPIs, etc.)
export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

export const MutedText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;
