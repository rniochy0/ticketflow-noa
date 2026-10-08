"use client";

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

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ padding: 16 }}>
      <Value>{value}</Value>
      <Label>{label}</Label>
    </Card>
  );
}