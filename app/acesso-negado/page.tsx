import Link from "next/link";
import { requireUser } from "@/lib/auth/session";

export default async function AccessDenied() {
  await requireUser();

  return (
    <main style={{ maxWidth: 480, margin: "3rem auto", padding: 16, display: "grid", gap: 12 }}>
      <h1>Acesso negado</h1>
      <p>Não tens permissão para ver esta página.</p>
      <Link href="/">Voltar ao início</Link>
    </main>
  );
}
