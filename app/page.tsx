import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "3rem auto",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <h1>NOA HelpDesk</h1>
      <p>Olá, {profile?.full_name || user?.email}</p>
      <p>Perfil: {profile?.role}</p>
      <form action={logout}>
        <Button type="submit" $variant="secondary">
          Sair
        </Button>
      </form>
    </main>
  );
}