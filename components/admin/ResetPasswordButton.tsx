"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { resetUserPassword } from "@/app/admin/users/actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("Gerar uma nova password temporária e enviá-la por email a este utilizador?")) {
      return;
    }
    startTransition(async () => {
      const r = await resetUserPassword(userId);
      if (!r.ok) return window.alert(r.error);
      window.alert(
        r.emailSent
          ? "Nova password temporária enviada por email."
          : `Não foi possível enviar o email. Entrega esta password por um canal seguro:\n\n${r.tempPassword}`
      );
    });
  }

  return (
    <Button type="button" $variant="secondary" disabled={pending} onClick={onClick}>
      Nova password
    </Button>
  );
}