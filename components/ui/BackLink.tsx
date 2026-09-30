"use client";

import Link from "next/link";
import styled from "styled-components";

const StyledLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;
  font-size: ${({ theme }) => theme.fontSizes.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    text-decoration: underline;
  }
`;

export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return <StyledLink href={href}>← {label}</StyledLink>;
}