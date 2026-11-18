"use client";

import styled from "styled-components";

// Aviso de erro de formulário, partilhado (evita repetir este bloco em cada form)
export const ErrorBanner = styled.p.attrs({ role: "alert" })`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fee2e2;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

export const SuccessBanner = styled.p.attrs({ role: "status" })`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #dcfce7;
  color: #166534;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;
