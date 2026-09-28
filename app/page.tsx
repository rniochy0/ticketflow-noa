"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function Home() {
  return (
    <main style={{ maxWidth: 360, margin: "3rem auto", display: "grid", gap: 16, padding: 16 }}>
      <Input label="Email" type="email" placeholder="nome@noa.ao" />
      <Input label="Password" type="password" error="Campo obrigatório" />
      <Button $fullWidth>Entrar</Button>
      <Button $variant="secondary" $fullWidth>Cancelar</Button>
    </main>
  );
}