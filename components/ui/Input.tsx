"use client";

import styled from "styled-components";
import { useId } from "react";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
`;

const StyledInput = styled.input<{ $hasError?: boolean }>`
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

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, ...props }: Props) {
  const id = useId();
  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      <StyledInput
        id={id}
        $hasError={!!error}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <ErrorText id={`${id}-error`} role="alert">{error}</ErrorText>}
    </Wrapper>
  );
}