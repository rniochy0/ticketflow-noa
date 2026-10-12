"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";

// Botão Activar/Desactivar genérico (sites, categorias, subcategorias).
export function ActiveToggleButton({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: (next: boolean) => Promise<unknown>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      $variant={isActive ? "secondary" : "primary"}
      disabled={pending}
      onClick={() => startTransition(async () => { await onToggle(!isActive); })}
    >
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
