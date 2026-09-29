import { requirePermission } from "@/lib/auth/session";

export default async function ItHome() {
  // Os layouts não voltam a correr em navegações internas:
  // cada página valida também por si (defesa em profundidade)
  const user = await requirePermission("ticket:view_all");

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: 16 }}>
      <h1>Central do IT</h1>
      <p>Olá, {user.fullName || user.email} ({user.role})</p>
    </main>
  );
}