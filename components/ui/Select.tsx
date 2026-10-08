"use client";

import styled from "styled-components";
import { useId } from "react";
import { FieldWrapper, FieldLabel, FieldError, fieldControlCss } from "./Field";

const StyledSelect = styled.select<{ $hasError?: boolean }>`
  ${fieldControlCss}
`;

type Option = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string;
};

export function Select({ label, options, placeholder, error, ...props }: Props) {
  const id = useId();
  return (
    <FieldWrapper>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <StyledSelect
        id={id}
        $hasError={!!error}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        defaultValue=""
        {...props}
      >
        <option value="" disabled>
          {placeholder ?? "Selecciona..."}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </StyledSelect>
      {error && (
        <FieldError id={`${id}-error`} role="alert">
          {error}
        </FieldError>
      )}
    </FieldWrapper>
  );
}
