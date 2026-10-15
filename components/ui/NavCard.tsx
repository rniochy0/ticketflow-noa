"use client";

import Link from "next/link";
import styled from "styled-components";

const Wrap = styled(Link)`
  display: grid;
  gap: 2px;
  padding: ${({ theme }) => theme.spacing.md};
  min-height: 56px; /* alvo de toque confortável no telemóvel */
  color: inherit;
  text-decoration: none;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  transition: border-color 0.15s;

  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Desc = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

export function NavCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description?: string;
}) {
  return (
    <Wrap href={href}>
      <strong>{title}</strong>
      {description && <Desc>{description}</Desc>}
    </Wrap>
  );
}