"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MutedText } from "@/components/layout/Stack";
import { changePassword, type PasswordState } from "@/app/conta/password/actions";

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changePassword, {});

  // Depois de definir a nova password (obrigatória), segue para o início
  useEffect(() => {
    if (state.ok && forced) router.replace("/");
  }, [state.ok, forced, router]);

  return (
    <Card>
      <form
        // key força o reset dos campos depois de uma alteração bem-sucedida
        key={state.ok ? "done" : "form"}
        action={formAction}
        noValidate
        style={{ display: "grid", gap: 16 }}
      >
        {state.error && (
          <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }} role="alert">{state.error}</p>
        )}
        {state.ok && <MutedText role="status">Password alterada com sucesso.</MutedText>}

        <Input label="Password atual" name="currentPassword" type="password"
          autoComplete="current-password" error={state.fieldErrors?.currentPassword} />
        <Input label="Nova password" name="newPassword" type="password"
          autoComplete="new-password" error={state.fieldErrors?.newPassword} />
        <Input label="Confirmar nova password" name="confirm" type="password"
          autoComplete="new-password" error={state.fieldErrors?.confirm} />
        <MutedText>Mínimo 10 caracteres, com letras e números.</MutedText>

        <Button type="submit" disabled={pending}>
          {pending ? "A guardar..." : "Alterar password"}
        </Button>
      </form>
    </Card>
  );
}