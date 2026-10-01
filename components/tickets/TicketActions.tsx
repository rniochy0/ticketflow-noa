"use client";

import { useTransition, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import { statusLabels, type TicketStatus } from "@/components/ui/Badge";
import {
  assignToMe,
  assignTechnician,
  changeStatus,
  changePriority,
} from "@/app/tickets/actions";

// Espelha as transições que o trigger tickets_before_update já impõe na BD
// (0002_tickets.sql) — isto é só para a UI mostrar botões com sentido,
// a BD continua a ser quem decide de verdade.
const AGENT_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_USER", "RESOLVED"],
  WAITING_USER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

const priorityOptions = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

type Technician = { id: string; full_name: string };

export function StaffActionsPanel({
  ticketId,
  status,
  priority,
  assigneeId,
  currentUserId,
  technicians,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: string;
  assigneeId: string | null;
  currentUserId: string;
  technicians: Technician[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Ocorreu um erro.");
    });
  }

  const isUnassigned = !assigneeId;
  const isMine = assigneeId === currentUserId;
  const nextStatuses = AGENT_TRANSITIONS[status];

  return (
    <Card>
      <Stack $gap="md">
        <h3 style={{ margin: 0, fontSize: 16 }}>Atendimento</h3>
        {error && <ErrorText role="alert">{error}</ErrorText>}

        {isUnassigned && (
          <Button
            disabled={pending}
            onClick={() => run(() => assignToMe(ticketId))}
          >
            Assumir ticket
          </Button>
        )}

        {!isUnassigned && isMine && (
          <MutedText>Este ticket está atribuído a ti.</MutedText>
        )}

        <form
          action={(fd) => run(() => assignTechnician(fd))}
          style={{ display: "flex", gap: 8, alignItems: "end" }}
        >
          <input type="hidden" name="ticketId" value={ticketId} />
          <div style={{ flex: 1 }}>
            <Select
              label="Atribuir a"
              name="technicianId"
              defaultValue={assigneeId ?? ""}
              options={technicians.map((t) => ({ value: t.id, label: t.full_name || "—" }))}
            />
          </div>
          <Button type="submit" $variant="secondary" disabled={pending}>
            Atribuir
          </Button>
        </form>

        <form
          action={(fd) => run(() => changePriority(fd))}
          style={{ display: "flex", gap: 8, alignItems: "end" }}
        >
          <input type="hidden" name="ticketId" value={ticketId} />
          <div style={{ flex: 1 }}>
            <Select
              label="Prioridade"
              name="priority"
              defaultValue={priority}
              options={priorityOptions}
            />
          </div>
          <Button type="submit" $variant="secondary" disabled={pending}>
            Guardar
          </Button>
        </form>

        {nextStatuses.length > 0 && (
          <Stack $gap="xs">
            <MutedText>Mudar estado</MutedText>
            <Inline $gap="sm">
              {nextStatuses.map((next) => (
                <form key={next} action={(fd) => run(() => changeStatus(fd))}>
                  <input type="hidden" name="ticketId" value={ticketId} />
                  <input type="hidden" name="status" value={next} />
                  <Button type="submit" $variant="secondary" disabled={pending}>
                    {statusLabels[next]}
                  </Button>
                </form>
              ))}
            </Inline>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function RequesterCloseAction({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "RESOLVED") return null;

  return (
    <Card>
      <Stack $gap="sm">
        {error && <ErrorText role="alert">{error}</ErrorText>}
        <MutedText>O técnico marcou este ticket como resolvido.</MutedText>
        <form
          action={(fd) =>
            startTransition(async () => {
              setError(null);
              const result = await changeStatus(fd);
              if (!result.ok) setError(result.error ?? "Ocorreu um erro.");
            })
          }
        >
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="status" value="CLOSED" />
          <Button type="submit" disabled={pending}>
            Confirmar e fechar
          </Button>
        </form>
      </Stack>
    </Card>
  );
}