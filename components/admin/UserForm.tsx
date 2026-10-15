"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Stack, Inline, MutedText } from "@/components/layout/Stack";
import type { Role } from "@/lib/auth/roles";
import { roleLabels } from "@/lib/validation/user";
import type { UserFormState } from "@/app/admin/users/actions";

type Option = { value: string; label: string };
type Action = (state: UserFormState, formData: FormData) => Promise<UserFormState>;


export type UserFormValues = {
  email?: string;
  fullName?: string;
  role?: string;
  storeId?: string;
  departmentId?: string;
  jobTitle?: string;
};

export function UserForm({
  action,
  mode,
  initialValues,
  sites,
  departments,
  roles,
}: {
  action: Action;
  mode: "create" | "edit";
  initialValues?: UserFormValues;
  sites: Option[];
  departments: Option[];
  // Perfis que quem está a editar pode atribuir (o gestor não vê ADMIN)
  roles: readonly Role[];
}) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, {
    values: initialValues,
  });
  const v = (state.values ?? initialValues ?? {}) as UserFormValues;

  if (state.created) {
    return (
      <Card>
        <Stack $gap="md">
          <strong>Utilizador criado</strong>
          <MutedText>Email: {state.created.email}</MutedText>
          {state.created.emailSent ? (
            <MutedText>
              Enviámos a password temporária para este email. No primeiro acesso, o
              utilizador terá de definir uma password nova.
            </MutedText>
          ) : (
            <>
              <MutedText>
                Não foi possível enviar o email. Entrega esta password por um canal seguro
                (só é mostrada agora):
              </MutedText>
              <code style={{ fontSize: 18, userSelect: "all" }}>{state.created.tempPassword}</code>
            </>
          )}
          <Inline $gap="sm">
            <Link href="/admin/users/new">
              <Button $variant="secondary">Criar outro</Button>
            </Link>
            <Link href="/admin/users">
              <Button>Ver utilizadores</Button>
            </Link>
          </Inline>
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} noValidate style={{ display: "grid", gap: 16 }}>
        {state.error && (
          <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }} role="alert">
            {state.error}
          </p>
        )}

        {mode === "create" ? (
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="off"
            defaultValue={v.email}
            error={state.fieldErrors?.email}
          />
        ) : (
          <MutedText>Email: {v.email}</MutedText>
        )}

        <Input
          label="Nome completo"
          name="fullName"
          defaultValue={v.fullName}
          error={state.fieldErrors?.fullName}
          maxLength={120}
        />
        <Select
          label="Perfil"
          name="role"
          options={roles.map((r) => ({ value: r, label: roleLabels[r] }))}
          defaultValue={v.role || "COLLABORATOR"}
          error={state.fieldErrors?.role}
        />
        <Select
          label="Site"
          name="storeId"
          options={[{ value: "", label: "Sem site" }, ...sites]}
          defaultValue={v.storeId ?? ""}
          error={state.fieldErrors?.storeId}
        />
        {departments.length > 0 && (
          <Select
            label="Departamento"
            name="departmentId"
            options={[{ value: "", label: "Sem departamento" }, ...departments]}
            defaultValue={v.departmentId ?? ""}
            error={state.fieldErrors?.departmentId}
          />
        )}
        <Input
          label="Função"
          name="jobTitle"
          defaultValue={v.jobTitle}
          error={state.fieldErrors?.jobTitle}
          maxLength={100}
        />

        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : mode === "create" ? "Criar utilizador" : "Guardar"}
        </Button>
      </form>
    </Card>
  );
}