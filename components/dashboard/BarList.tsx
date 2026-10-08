"use client";

import styled from "styled-components";

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Row = styled.li`
  display: grid;
  gap: 4px;
`;

const RowTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const Track = styled.div`
  height: 8px;
  background: ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 999px;
`;

// Barras horizontais proporcionais ao maior valor. O número aparece sempre
// em texto ao lado, por isso a informação não depende só da barra (acessível).
export function BarList({ items }: { items: { name: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <List>
      {items.map((item) => (
        <Row key={item.name}>
          <RowTop>
            <span>{item.name}</span>
            <strong>{item.count}</strong>
          </RowTop>
          <Track aria-hidden="true">
            <Fill $pct={(item.count / max) * 100} />
          </Track>
        </Row>
      ))}
    </List>
  );
}
