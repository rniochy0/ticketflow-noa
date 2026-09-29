"use client";

import { useActionState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { login } from "./actions";

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

const ErrorMessage = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.danger};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const initialState = {
  error: undefined,
};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Page>
      <Panel>
        <div>
          <Title>NOA HelpDesk</Title>
          <Subtitle>Entra com a tua conta da empresa</Subtitle>
        </div>

        <form
          action={formAction}
          noValidate
          style={{ display: "grid", gap: 16 }}
        >
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {state.error && (
            <ErrorMessage role="alert">
              {state.error}
            </ErrorMessage>
          )}

          <Button type="submit" $fullWidth disabled={pending}>
            {pending ? "A entrar..." : "Entrar"}
          </Button>
        </form>
      </Panel>
    </Page>
  );
}
