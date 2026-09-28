"use client";

import { useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { loginSchema } from "@/lib/validation/auth";

const Page = styled.main`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.spacing.md};
`;

const Panel = styled(Card)`
  width: 100%;
  max-width: 400px;
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.xl};
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);

    const parsed = loginSchema.safeParse({
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    // TODO: chamar a Server Action de login (Supabase) quando houver credenciais
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
  }

  return (
    <Page>
      <Panel>
        <div>
          <Title>NOA HelpDesk</Title>
          <Subtitle>Entra com a tua conta da empresa</Subtitle>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: "grid", gap: 16 }}>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            error={errors.email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={errors.password}
          />
          <Button type="submit" $fullWidth disabled={loading}>
            {loading ? "A entrar..." : "Entrar"}
          </Button>
        </form>
      </Panel>
    </Page>
  );
}