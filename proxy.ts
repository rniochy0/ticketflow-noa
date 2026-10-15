import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withSecurityHeaders } from "@/lib/security/headers";
import { embedCookieOptions } from "@/lib/supabase/cookie-options";

async function handle(request: NextRequest) {
  // As rotas de cron não têm sessão de utilizador: autenticam-se com CRON_SECRET
  // dentro da própria rota (falha fechada se o segredo não existir).
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: embedCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Valida o token no servidor Supabase (getSession() não serve para autorização)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname === "/login";

  // Password temporária: até a trocar, só pode ver a página de troca (ou sair).
  // app_metadata só é alterável pelo servidor, o utilizador não a limpa sozinho.
  const mustChange = user?.app_metadata?.must_change_password === true;
  const path = request.nextUrl.pathname;
  if (user && mustChange && path !== "/conta/password" && path !== "/auth/end-session") {
    return NextResponse.redirect(new URL("/conta/password?obrigatorio=1", request.url));
  }

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export async function proxy(request: NextRequest) {
  return withSecurityHeaders(await handle(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};