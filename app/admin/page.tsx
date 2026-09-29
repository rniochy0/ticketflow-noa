import { requirePermission } from "@/lib/auth/session";

export default async function AdminHome() {
  const user = await requirePermission("admin:manage");

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: 16 }}>
      <h1>Administração</h1>
      <p>Olá, {user.fullName || user.email} ({user.role})</p>
    </main>
  );
}