"use client";

import styled from "styled-components";

// Empilhamento vertical com espaçamento do theme — evita repetir
// display:grid/flex + gap em cada página que precisa de uma lista/coluna
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

export const MutedText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;
