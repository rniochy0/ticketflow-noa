"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SITE_TYPES, siteTypeLabels } from "@/lib/validation/site";
import type { SiteFormState } from "@/app/admin/sites/actions";

const typeOptions = SITE_TYPES.map((t) => ({ value: t, label: siteTypeLabels[t] }));

type Action = (state: SiteFormState, formData: FormData) => Promise<SiteFormState>;

export function SiteForm({
  action,
  initialValues,
  submitLabel = "Criar site",
}: {
  action: Action;
  initialValues?: { code?: string; name?: string; type?: string };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<SiteFormState, FormData>(
    action,
    { values: initialValues }
  );

  const values = state.values ?? initialValues;

  return (
    <Card>
      <form action={formAction} noValidate style={{ display: "grid", gap: 16 }}>
        {state.error && (
          <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }} role="alert">
            {state.error}
          </p>
        )}

        <Input
          label="Código"
          name="code"
          defaultValue={values?.code}
          error={state.fieldErrors?.code}
          placeholder="Ex: L12, SEDE, LOG01"
          maxLength={20}
        />
        <Input
          label="Nome"
          name="name"
          defaultValue={values?.name}
          error={state.fieldErrors?.name}
          maxLength={100}
        />
        <Select
          label="Tipo"
          name="type"
          options={typeOptions}
          defaultValue={values?.type || "STORE"}
          error={state.fieldErrors?.type}
        />

        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
