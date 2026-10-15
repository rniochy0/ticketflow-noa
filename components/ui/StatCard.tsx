"use client";

import Link from "next/link";
import styled from "styled-components";
import { Card } from "./Card";

const Value = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: 700;
`;

const Label = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CardLink = styled(Link)`
  display: block;
  color: inherit;
  text-decoration: none;
  border-radius: ${({ theme }) => theme.radius.md};

  &:hover > * {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

// href é opcional: quando existe, o cartão leva à lista já filtrada
export function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const card = (
    <Card style={{ padding: 16 }}>
      <Value>{value}</Value>
      <Label>{label}</Label>
    </Card>
  );
  return href ? <CardLink href={href}>{card}</CardLink> : card;
}
