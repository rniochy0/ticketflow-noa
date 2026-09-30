"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { toggleSiteActive } from "@/app/admin/sites/actions";

export function SiteActiveToggle({
  siteId,
  isActive,
}: {
  siteId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      $variant={isActive ? "secondary" : "primary"}
      disabled={pending}
      onClick={() => startTransition(() => toggleSiteActive(siteId, !isActive))}
    >
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}