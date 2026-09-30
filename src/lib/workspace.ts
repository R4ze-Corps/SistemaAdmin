import { Account, AuthError } from "./auth";
export function workspaceFor(user: Account, mode: string | null) {
  const beta = mode === "beta";
  if (mode && !["beta", "production"].includes(mode)) throw new AuthError("Ambiente inválido.", 400);
  if (beta !== Boolean(user.preferences?.betaEnabled)) throw new AuthError("O ambiente foi alterado. Recarregue a página antes de continuar.", 409);
  const id = user._id.toHexString();
  return { mode: beta ? "beta" : "production", collection: beta ? "app_state_beta" : "app_state", key: beta ? id : "main", documentPrefix: beta ? `beta/${id}/reservas/` : "reservas/" };
}
export function assertDocument(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix) || pathname.includes("..") || pathname.includes("\\")) throw new AuthError("Arquivo fora do ambiente atual.", 403);
}
