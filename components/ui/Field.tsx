"use client";

import styled, { css } from "styled-components";

// Partilhado por Input e Select (e por qualquer campo de formulário futuro:
// TextArea, DatePicker, etc.) — evita repetir Wrapper/Label/Error em cada um
export const FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
`;

export const FieldError = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

// Estilo base partilhado por qualquer control de formulário (input, select, textarea).
// Cada um continua a usar a sua própria tag styled (<input>/<select>/<textarea>) —
// só a aparência é partilhada, para não repetir isto em cada ficheiro.
export const fieldControlCss = css<{ $hasError?: boolean }>`
  min-height: 44px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  font-size: 16px; /* 16px evita o zoom automático do iOS ao focar */
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.danger : theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }
`;
