"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import {
  FieldWrapper,
  FieldLabel,
  FieldError,
  fieldControlCss,
} from "@/components/ui/Field";
import { AttachmentPicker } from "@/components/tickets/AttachmentPicker";
import { uploadFiles } from "@/lib/attachments/client";
import { createTicket } from "@/app/tickets/actions";

const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

const TextArea = styled.textarea<{ $hasError?: boolean }>`
  ${fieldControlCss}
  min-height: 140px;
  padding: ${({ theme }) => theme.spacing.md};
  font: inherit;
  resize: vertical;
`;

const ErrorBanner = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fee2e2;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const priorityOptions = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

type CategoryRow = { id: string; name: string };
type SubcategoryRow = { id: string; name: string; category_id: string };

export function NewTicketForm({
  categories,
  subcategories,
}: {
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");

  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId]
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      // 1) cria o pedido (só texto). Se a rede falhar, os campos mantêm-se.
      let result: Awaited<ReturnType<typeof createTicket>>;
      try {
        result = await createTicket({}, formData);
      } catch {
        setError(
          "Sem ligação ao servidor. O pedido não foi criado — os dados continuam no formulário, tenta de novo."
        );
        return;
      }
      if (!result.ticketId) {
        setError(result.error ?? null);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      // Daqui para a frente o pedido JÁ existe: bloqueia novo envio para
      // não criar duplicados enquanto os anexos seguem.
      setDone(true);

      // 2) envia os anexos (se houver) e segue para o pedido
      let failed = 0;
      if (files.length > 0) {
        const outcome = await uploadFiles({
          ticketId: result.ticketId,
          files,
          onProgress: (current, total) =>
            setProgress(`A enviar anexos (${current}/${total})...`),
        });
        failed = outcome.failed;
      }
      router.push(
        failed > 0
          ? `/tickets/${result.ticketId}?attach=partial`
          : `/tickets/${result.ticketId}`
      );
    });
  }

  const busy = pending || done;

  return (
    <Card>
      <Form onSubmit={handleSubmit} noValidate>
        {error && <ErrorBanner role="alert">{error}</ErrorBanner>}

        <Input
          label="Título"
          name="title"
          error={fieldErrors.title}
          maxLength={150} 
          disabled={busy}
        />

        <FieldWrapper>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          <TextArea
            id="description"
            name="description"
            $hasError={!!fieldErrors.description}
            maxLength={5000}
            disabled={busy}
          />
          {fieldErrors.description && (
            <FieldError role="alert">{fieldErrors.description}</FieldError>
          )}
        </FieldWrapper>

        <Select
          label="Categoria"
          name="categoryId"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          error={fieldErrors.categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={busy}
        />

        <Select
          label="Subcategoria (opcional)"
          name="subcategoryId"
          placeholder="Nenhuma"
          options={filteredSubcategories.map((s) => ({ value: s.id, label: s.name }))}
          disabled={busy || filteredSubcategories.length === 0}
        />

        <Select
          label="Prioridade"
          name="priority"
          options={priorityOptions}
          defaultValue="MEDIUM"
          error={fieldErrors.priority}
          disabled={busy}
        />

        <AttachmentPicker files={files} onChange={setFiles} disabled={busy} />

        <Button type="submit" $fullWidth disabled={busy}>
          {busy ? (progress ?? "A enviar...") : "Enviar pedido"}
        </Button>
      </Form>
    </Card>
  );
}