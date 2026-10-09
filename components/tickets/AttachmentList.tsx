"use client";

import styled from "styled-components";
import { formatBytes } from "@/lib/attachments/constants";

export type AttachmentRow = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  purged: boolean;
};

const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const ImageLink = styled.a`
  display: block;
  line-height: 0;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Thumb = styled.img`
  display: block;
  width: 120px;
  height: 90px;
  object-fit: cover;
`;

// Cores explícitas (fundo claro + texto escuro) para ler bem tanto na
// bolha azul das mensagens próprias como no resto da página.
const FileChip = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-decoration: none;
`;

const PurgedChip = styled.span`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textMuted};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-style: italic;
`;

export function AttachmentList({ items }: { items: AttachmentRow[] }) {
  if (items.length === 0) return null;

  return (
    <Wrap>
      {items.map((a) => {
        if (a.purged) {
          return <PurgedChip key={a.id}>Anexo removido (período de retenção)</PurgedChip>;
        }
        const href = `/api/attachments/${a.id}`;
        return a.mime_type.startsWith("image/") ? (
          <ImageLink key={a.id} href={href} target="_blank" rel="noopener noreferrer" title={a.file_name}>
            <Thumb src={href} alt={a.file_name} loading="lazy" />
          </ImageLink>
        ) : (
          <FileChip key={a.id} href={href} rel="noopener noreferrer">
            PDF · {a.file_name} ({formatBytes(a.size_bytes)})
          </FileChip>
        );
      })}
    </Wrap>
  );
}