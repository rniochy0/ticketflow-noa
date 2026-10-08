import { requirePermission } from "@/lib/auth/session";

export default async function ItLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("ticket:view_all");
  return <>{children}</>;
}
