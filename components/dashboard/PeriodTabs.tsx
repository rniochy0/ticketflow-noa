"use client";

import Link from "next/link";
import styled from "styled-components";
import { PERIODS, periodLabels, type Period } from "@/lib/dashboard/period";

const Tabs = styled.nav`
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  width: fit-content;
`;

const Tab = styled(Link)<{ $active: boolean }>`
  padding: 6px ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  text-decoration: none;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};
`;

// Links normais (não estado no cliente): o período vive na URL,
// por isso a vista é partilhável e sobrevive a um refresh.
export function PeriodTabs({ current }: { current: Period }) {
  return (
    <Tabs aria-label="Período">
      {PERIODS.map((p) => (
        <Tab
          key={p}
          href={`/dashboard?period=${p}`}
          $active={p === current}
          aria-current={p === current ? "page" : undefined}
        >
          {periodLabels[p]}
        </Tab>
      ))}
    </Tabs>
  );
}