"use client";

import { BackLink } from "@/components/ui/BackLink";
import { PageTitle } from "./PageContainer";

// Usa-se no topo de toda a página que não seja a inicial: título + link de
// volta consistentes, em vez de cada página desenhar o seu próprio cabeçalho.
export function PageHeader({
  title,
  backHref,
  backLabel,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {backHref && <BackLink href={backHref} label={backLabel} />}
      <PageTitle>{title}</PageTitle>
    </div>
  );
}
