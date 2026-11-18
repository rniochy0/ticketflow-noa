"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import {
  cancelSupplyRequest,
  decideSupplyRequest,
  deliverSupplyRequest,
  type SupplyActionState,
} from "@/app/materiais/actions";

export function SupplyRequestActions({
  requestId,
  canDecide,
  canDeliver,
  canCancel,
  defaultReceiver,
  stockIssue,
}: {
  requestId: string;
  canDecide: boolean;
  canDeliver: boolean;
  canCancel: boolean;
  defaultReceiver: string;
  stockIssue: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [receiver, setReceiver] = useState(defaultReceiver);

  if (!canDecide && !canDeliver && !canCancel) return null;

  function run(fn: () => Promise<SupplyActionState>) {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.error) setError(r.error);
        else router.refresh();
      } catch {
        setError("Sem ligação ao servidor. Tenta novamente.");
      }
    });
  }

  return (
    <Card style={{ padding: 16 }}>
      <Stack $gap="md">
        {error && <ErrorBanner>{error}</ErrorBanner>}

        {canDecide && (
          <Stack $gap="sm">
            <Input
              label="Nota (obrigatória para rejeitar)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              disabled={pending}
            />
            <Inline $gap="sm">
              <Button type="button" disabled={pending} onClick={() => run(() => decideSupplyRequest(requestId, true, note))}>
                Aprovar
              </Button>
              <Button
                type="button"
                $variant="secondary"
                disabled={pending}
                onClick={() => run(() => decideSupplyRequest(requestId, false, note))}
              >
                Rejeitar
              </Button>
            </Inline>
          </Stack>
        )}

        {canDeliver && (
          <Stack $gap="sm">
            {stockIssue && (
              <MutedText>
                Há artigos sem stock suficiente (a vermelho). Regista a entrada de stock antes de
                entregar.
              </MutedText>
            )}
            <Input
              label="Recebido por"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              maxLength={120}
              disabled={pending}
            />
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => deliverSupplyRequest(requestId, receiver))}
            >
              {pending ? "A processar..." : "Entregar e emitir guia"}
            </Button>
            <MutedText>
              Desconta o stock, emite a guia e envia o PDF ao solicitante por email.
            </MutedText>
          </Stack>
        )}

        {canCancel && (
          <Button
            type="button"
            $variant="secondary"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancelar este pedido de material?")) {
                run(() => cancelSupplyRequest(requestId));
              }
            }}
          >
            Cancelar pedido
          </Button>
        )}
      </Stack>
    </Card>
  );
}
