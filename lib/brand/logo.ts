import "server-only";

// O logo vive em public/logo-noa.png (servido pelo próprio site). Nas funções
// serverless da Vercel a pasta public pode não estar no disco, por isso vai-se
// buscar por HTTP, com limite de tempo. Se faltar ou falhar, o PDF sai sem logo
// (com o nome em texto) em vez de falhar a entrega.
export async function loadLogoPng(): Promise<Uint8Array | undefined> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${base}/logo-noa.png`, {
      signal: AbortSignal.timeout(3000),
      cache: "force-cache",
    });
    if (!res.ok) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // assinatura PNG: 89 50 4E 47
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return undefined;
    if (bytes.length > 2 * 1024 * 1024) return undefined;
    return bytes;
  } catch {
    return undefined;
  }
}
