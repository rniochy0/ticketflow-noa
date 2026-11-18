// As funções SQL de material lançam mensagens em português já pensadas para o
// utilizador, com códigos P0001/P0002/22023. Qualquer outro erro (permissões,
// chaves duplicadas, falhas internas) NUNCA é mostrado em bruto.
const SAFE_CODES = ["P0001", "P0002", "22023"];

export function supplyErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  fallback = "Não foi possível concluir a ação. Tenta novamente."
): string {
  if (!error) return fallback;
  if (error.code && SAFE_CODES.includes(error.code) && error.message) return error.message;
  if (error.code === "42501") return "Não tens permissão para esta ação.";
  if (error.code === "23505") return "Já existe um registo igual.";
  return fallback;
}
