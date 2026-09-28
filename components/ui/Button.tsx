"use client";

import styled, { css } from "styled-components";

type Variant = "primary" | "secondary" | "danger";

const variants = {
  primary: css`
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    border: 1px solid transparent;
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primaryHover};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.background};
    }
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.danger};
    color: #fff;
    border: 1px solid transparent;
    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  `,
};

export const Button = styled.button<{ $variant?: Variant; $fullWidth?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 44px; /* área de toque confortável no telemóvel */
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  cursor: pointer;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  transition: background 0.15s, opacity 0.15s;

  ${({ $variant = "primary" }) => variants[$variant]}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;