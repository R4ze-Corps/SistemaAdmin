import { Account, AuthError, authFailure, authorize, createSession, hashPassword, legacyLoginFilter, normalizeLogin, publicAccount, rateLimit, revokeOtherSessions, validLogin, verifyPassword } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await authorize();
    const activeSessions = await (await getDatabase()).collection("auth_sessions").countDocuments({ userId: user._id, expiresAt: { $gt: new Date() } });
    return Response.json({ user: publicAccount(user), activeSessions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await authorize(request);
    const body = await request.json();
    const db = await getDatabase();
    const users = db.collection<Account>("users");
    if (body.action === "sessions") {
      await revokeOtherSessions(user);
      return Response.json({ user: publicAccount(user), message: "Outras sessões encerradas.", activeSessions: 1 });
    }
    if (body.action === "preferences") {
      if (!["light", "dark", "system"].includes(body.theme)) throw new AuthError("Tema inválido.", 400);
      user.preferences = { theme: body.theme };
      await users.updateOne({ _id: user._id }, { $set: { preferences: user.preferences } });
    } else if (body.action === "profile") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const username = normalizeLogin(body.username);
      if (name.length < 2 || name.length > 100 || !validLogin(username)) throw new AuthError("Informe um nome válido e um login de 3 a 50 caracteres.", 400);
      if (username !== user.username) {
        const password = typeof body.currentPassword === "string" ? body.currentPassword : "";
        await rateLimit(request, user.username ?? normalizeLogin(user.name));
        if (password.length > 128 || !await verifyPassword(password, user.passwordHash)) throw new AuthError("Confirme sua senha atual para alterar o login.", 403);
        const conflict = await users.findOne({ _id: { $ne: user._id }, $or: [{ username }, legacyLoginFilter(username)] });
        if (conflict) throw new AuthError("Este login já está em uso.", 409);
        await users.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } });
      }
      const result = await users.updateOne({ _id: user._id, passwordHash: user.passwordHash }, { $set: { name, username } });
      if (!result.matchedCount) throw new AuthError("A conta foi atualizada em outra sessão. Recarregue a página.", 409);
      user.name = name; user.username = username;
    } else if (body.action === "password") {
      const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 4 || password.length > 8) throw new AuthError("A nova senha deve ter de 4 a 8 caracteres.", 400);
      await rateLimit(request, user.username ?? normalizeLogin(user.name));
      if (current.length > 128 || !await verifyPassword(current, user.passwordHash)) throw new AuthError("Senha atual incorreta.", 403);
      const passwordHash = await hashPassword(password);
      const result = await users.updateOne({ _id: user._id, passwordHash: user.passwordHash }, { $set: { passwordHash } });
      if (!result.matchedCount) throw new AuthError("A senha já foi alterada em outra sessão. Entre novamente.", 409);
      user.passwordHash = passwordHash;
      await db.collection("auth_sessions").deleteMany({ userId: user._id });
      await createSession(user);
    } else throw new AuthError("Configuração inválida.", 400);
    return Response.json({ user: publicAccount(user), message: body.action === "password" ? "Senha alterada. As sessões anteriores foram encerradas." : "Alterações salvas no MongoDB." });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return authFailure(new AuthError("Este login já está em uso.", 409));
    return authFailure(error);
  }
}
