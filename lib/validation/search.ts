// Texto livre que vai para um filtro .or() do PostgREST: , ( ) * % e : têm
// significado na sintaxe do filtro e permitiriam injectar condições.
// Mantemos só letras, números, espaço e . @ _ - (suficiente para nomes,
// emails e números NOA-00001) e limitamos o tamanho.
export function sanitizeSearch(input: string | undefined | null, max = 80): string {
  return (input ?? "")
    .replace(/[^\p{L}\p{N} ._@-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}