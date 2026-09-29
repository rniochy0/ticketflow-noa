import { requirePermission } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("admin:manage");
  return <>{children}</>;
}