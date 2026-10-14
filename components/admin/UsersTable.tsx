"use client";

import Link from "next/link";
import { ScrollArea, Table, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Inline } from "@/components/layout/Stack";
import { ActiveToggleButton } from "./ActiveToggleButton";
import { roleLabels } from "@/lib/validation/user";
import { toggleUserActive } from "@/app/admin/users/actions";
import { canManageUser, type Role } from "@/lib/auth/roles";

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  siteName: string;
};

export function UsersTable({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: UserRow[];
  currentUserId: string;
  currentUserRole: Role;
}) {
  if (users.length === 0) {
    return <EmptyState title="Sem resultados" description="Nenhum utilizador corresponde à pesquisa." />;
  }
  return (
    <ScrollArea>
      <Table>
        <thead>
          <tr>
            <Th>Nome</Th>
            <Th>Email</Th>
            <Th>Perfil</Th>
            <Th>Site</Th>
            <Th>Estado</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <Td>{u.full_name || "—"}</Td>
              <Td>{u.email}</Td>
              <Td>{roleLabels[u.role]}</Td>
              <Td>{u.siteName}</Td>
              <Td>{u.is_active ? "Ativo" : "Inativo"}</Td>
              <Td>
                {!canManageUser(currentUserRole, u.role) ? (
                  "—"
                ) : (
                <Inline $gap="xs">
                  <Link href={`/admin/users/${u.id}/edit`}>
                    <Button $variant="secondary">Editar</Button>
                  </Link>
                  {u.id !== currentUserId && (
                    <ActiveToggleButton
                      isActive={u.is_active}
                      onToggle={(next) => toggleUserActive(u.id, next)}
                    />
                  )}
                </Inline>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ScrollArea>
  );
}