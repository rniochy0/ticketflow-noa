import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a SECRET key (ignora o RLS). Usar SÓ em Server Actions que já
// passaram por requirePermission("admin:manage") e SÓ para o que o cliente
// normal não consegue fazer (criar/apagar utilizadores no Supabase Auth).
// A variável NUNCA tem prefixo NEXT_PUBLIC_ e nunca vai para o Git.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SECRET_KEY não está definida no servidor.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}