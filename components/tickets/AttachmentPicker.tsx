"use client";

import { useRef, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { Stack, MutedText } from "@/components/layout/Stack";
import {
  ACCEPT_ATTR,
  MAX_FILES_PER_UPLOAD,
  MAX_FILE_BYTES,
  formatBytes,
  validateSelectedFile,
} from "@/lib/attachments/constants";

const Chips = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Chip = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const ChipName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RemoveButton = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.md};
  min-width: 32px;
  min-height: 32px;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.danger};
  }
`;

// Componente "controlado": quem o usa guarda a lista de ficheiros e envia-os
// no momento certo (depois de criar o pedido ou a mensagem). O <input> não tem
// "name", por isso nunca vai dentro do formulário de texto.
export function AttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite escolher o mesmo ficheiro outra vez

    const next = [...files];
    let message: string | null = null;
    for (const file of picked) {
      if (next.length >= MAX_FILES_PER_UPLOAD) {
        message = `No máximo ${MAX_FILES_PER_UPLOAD} anexos de cada vez.`;
        break;
      }
      const problem = validateSelectedFile(file);
      if (problem) {
        message = problem;
        continue;
      }
      next.push(file);
    }
    setError(message);
    onChange(next);
  }

  function remove(index: number) {
    setError(null);
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <Stack $gap="xs">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={handleSelect}
        disabled={disabled}
      />
      <div>
        <Button
          type="button"
          $variant="secondary"
          disabled={disabled || files.length >= MAX_FILES_PER_UPLOAD}
          onClick={() => inputRef.current?.click()}
        >
          Anexar foto ou PDF
        </Button>
      </div>
      <MutedText style={{ fontSize: 12 }}>
        JPG, PNG, WebP ou PDF · até {formatBytes(MAX_FILE_BYTES)} cada · as fotos são reduzidas
        automaticamente
      </MutedText>

      {files.length > 0 && (
        <Chips>
          {files.map((file, index) => (
            <Chip key={`${file.name}-${index}`}>
              <ChipName title={file.name}>{file.name}</ChipName>
              <span>{formatBytes(file.size)}</span>
              <RemoveButton
                type="button"
                aria-label={`Remover ${file.name}`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                ✕
              </RemoveButton>
            </Chip>
          ))}
        </Chips>
      )}

      {error && <FieldError role="alert">{error}</FieldError>}
    </Stack>
  );
}
