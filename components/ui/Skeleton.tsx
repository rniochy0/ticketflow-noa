"use client";

import styled, { keyframes } from "styled-components";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`;

// Bloco cinzento animado para estados de carregamento (loading.tsx)
export const Skeleton = styled.div<{ $h?: number }>`
  height: ${({ $h = 16 }) => $h}px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.border};
  animation: ${pulse} 1.2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;