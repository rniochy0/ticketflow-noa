"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Stack, MutedText } from "@/components/layout/Stack";
import { sendTest, type TestEmailState } from "./actions";

export function EmailTestForm() {
  const [state, action, pending] = useActionState<TestEmailState, FormData>(
    () => sendTest(),
    {}
  );
  return (
    <form action={action}>
      <Stack $gap="sm">
        <Button type="submit" disabled={pending}>
          {pending ? "A enviar..." : "Enviar email de teste"}
        </Button>
        {state.message && <MutedText role="status">{state.message}</MutedText>}
      </Stack>
    </form>
  );
}