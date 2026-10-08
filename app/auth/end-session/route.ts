import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Usado quando a conta foi desactivada com sessão aberta.
// Route Handler porque só aqui é possível alterar cookies durante a renderização.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
