"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

// Fronteira de erro: nunca mostramos error.message ao utilizador (pode
// conter detalhes internos); só o digest, que serve para procurar nos logs.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer $size="sm">
      <EmptyState
        title="Algo correu mal"
        description={
          error.digest
            ? `Tenta novamente. Se persistir, indica ao IT o código ${error.digest}.`
            : "Tenta novamente dentro de instantes."
        }
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </PageContainer>
  );
}