"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Inline } from "@/components/layout/Stack";
import type { NameFormState } from "@/app/admin/categories/actions";

type Action = (state: NameFormState, formData: FormData) => Promise<NameFormState>;

// Formulário de uma linha (campo + botão) reutilizado para criar e renomear
// categorias e subcategorias. `hidden` leva os ids (categoryId / id).
export function InlineNameForm({
  action,
  label,
  submitLabel,
  hidden,
  initialName = "",
  onDone,
}: {
  action: Action;
  label: string;
  submitLabel: string;
  hidden?: Record<string, string>;
  initialName?: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<NameFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={formAction} noValidate>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Inline $gap="sm">
        <Input
          label={label}
          name="name"
          defaultValue={initialName}
          maxLength={100}
          error={state.error}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : submitLabel}
        </Button>
      </Inline>
    </form>
  );
}