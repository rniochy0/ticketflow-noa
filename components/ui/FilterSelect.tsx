"use client";

import styled from "styled-components";
import { fieldControlCss } from "./Field";

// Diferente do Select de formulários: aqui a opção vazia ("Todos") é válida
// e seleccionável, porque limpar um filtro é uma acção normal.
const StyledSelect = styled.select`
  ${fieldControlCss}
  min-height: 40px;
  padding-left: ${({ theme }) => theme.spacing.sm};
`;

type Option = { value: string; label: string };

export function FilterSelect({
  name,
  label,
  options,
  defaultValue,
  allLabel = "Todos",
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  // null = sem opção vazia (ex.: ordenação, que tem sempre um valor)
  allLabel?: string | null;
}) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <StyledSelect name={name} defaultValue={defaultValue ?? ""}>
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </StyledSelect>
    </label>
  );
}