"use client";

import styled from "styled-components";

const Wrapper = styled.div`
  display: grid;
  place-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Title = styled.p`
  margin: 0;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Wrapper>
      <Title>{title}</Title>
      {description && <p style={{ margin: 0, fontSize: 14 }}>{description}</p>}
      {action}
    </Wrapper>
  );
}