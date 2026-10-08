"use client";

import Link from "next/link";
import { ScrollArea, Table, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Inline } from "@/components/layout/Stack";
import { SiteActiveToggle } from "./SiteActiveToggle";
import { siteTypeLabels, type SiteType } from "@/lib/validation/site";

export type SiteRow = {
  id: string;
  code: string;
  name: string;
  type: SiteType;
  is_active: boolean;
};

export function SitesTable({ sites }: { sites: SiteRow[] }) {
  if (sites.length === 0) {
    return <EmptyState title="Ainda não há sites" description="Cria o primeiro site para começar." />;
  }

  return (
    <ScrollArea>
      <Table>
        <thead>
          <tr>
            <Th>Código</Th>
            <Th>Nome</Th>
            <Th>Tipo</Th>
            <Th>Estado</Th>
            <Th>Acções</Th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id}>
              <Td>{s.code}</Td>
              <Td>{s.name}</Td>
              <Td>{siteTypeLabels[s.type]}</Td>
              <Td>{s.is_active ? "Activo" : "Inactivo"}</Td>
              <Td>
                <Inline $gap="xs">
                  <Link href={`/admin/sites/${s.id}/edit`}>
                    <Button $variant="secondary">Editar</Button>
                  </Link>
                  <SiteActiveToggle siteId={s.id} isActive={s.is_active} />
                </Inline>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ScrollArea>
  );
}