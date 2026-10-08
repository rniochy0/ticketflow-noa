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
// Sem generic fixo em css<T>(): assim o TS não tenta unificar os tipos de props
// de <input>, <select> e <textarea>, que são diferentes entre si.
export const fieldControlCss = css`
  min-height: 44px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  font-size: 16px; /* 16px evita o zoom automático do iOS ao focar */
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid
    ${(props) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (props as any).$hasError ? props.theme.colors.danger : props.theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }
`;
