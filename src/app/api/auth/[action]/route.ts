import { ObjectId } from "mongodb";
import { Account, AuthError, authFailure, createSession, currentAccount, endSession, hashPassword, legacyLoginFilter, normalizeLogin, publicAccount, rateLimit, sameOrigin, secretMatches, validLogin, verifyPassword } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).action !== "me") throw new AuthError("Rota não encontrada.", 404);
    const user = await currentAccount();
    return Response.json({ user: user ? publicAccount(user) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const { action } = await context.params;
    if (action === "logout") { await endSession(); return Response.json({ ok: true }); }
    if (!["login", "register"].includes(action)) throw new AuthError("Rota não encontrada.", 404);
    if (Number(request.headers.get("content-length") || 0) > 4096) throw new AuthError("Solicitação muito grande.", 413);
    const body = await request.json().catch(() => { throw new AuthError("Dados inválidos.", 400); });
    const username = normalizeLogin(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    if (!validLogin(username)) throw new AuthError("Informe um nome de login de 3 a 50 caracteres (letras, números, espaços, ponto, hífen ou sublinhado).", 400);
    // Existing longer passwords remain valid for login; new passwords use 4–8 characters.
    const maximumPasswordLength = action === "register" ? 8 : 128;
    if (password.length < 4 || password.length > maximumPasswordLength) throw new AuthError(action === "register" ? "A senha deve ter de 4 a 8 caracteres." : "Informe sua senha (mínimo de 4 caracteres).", 400);
    await rateLimit(request, username);
    const db = await getDatabase();
    const users = db.collection<Account>("users");
    await users.createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } });
    if (action === "register") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 100) throw new AuthError("Informe um nome de 2 a 100 caracteres.", 400);
      const adminLogin = normalizeLogin(process.env.ADMIN_LOGIN);
      const setupKey = process.env.ADMIN_SETUP_KEY;
      if (!validLogin(adminLogin) || !setupKey || setupKey.length < 32) throw new AuthError("O administrador precisa configurar ADMIN_LOGIN e ADMIN_SETUP_KEY no servidor.", 503);
      const admin = username === adminLogin;
      if (admin && (typeof body.setupKey !== "string" || !secretMatches(body.setupKey, setupKey))) throw new AuthError("Chave de configuração inválida.", 403);
      if (await users.findOne({ $or: [{ username }, legacyLoginFilter(username)] })) throw new AuthError("Este nome de login já está em uso.", 409);
      // Preserve old email data/uniqueness, but allow multiple new accounts without email.
      const indexes = await users.listIndexes().toArray();
      for (const index of indexes) {
        if (index.name && index.unique && index.key.email === 1 && Object.keys(index.key).length === 1 && !index.sparse && !index.partialFilterExpression) {
          await users.createIndex({ email: 1 }, { name: "legacy_email_unique", unique: true, partialFilterExpression: { email: { $type: "string" } } });
          try { await users.dropIndex(index.name); } catch (error) { if ((error as { code?: number }).code !== 27) throw error; }
        }
      }
      const user: Account = { _id: new ObjectId(), name, username, passwordHash: await hashPassword(password), role: admin ? "admin" : "member", status: admin ? "approved" : "pending", createdAt: new Date() };
      try { await users.insertOne(user); }
      catch (error) { if ((error as { code?: number }).code === 11000) throw new AuthError("Não foi possível criar esta conta. Tente entrar ou contate o administrador.", 409); throw error; }
      if (admin) await createSession(user);
      return Response.json({ user: admin ? publicAccount(user) : null, pending: !admin, message: admin ? "Conta administradora criada." : "Cadastro recebido. Aguarde a aprovação do administrador." }, { status: 201 });
    }
    let user = await users.findOne({ username });
    if (!user) {
      const legacy = await users.find(legacyLoginFilter(username)).limit(2).toArray();
      if (legacy.length === 1) user = legacy[0];
    }
    // Run the same expensive derivation even when the login does not exist.
    const valid = await verifyPassword(password, user?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`);
    if (!user || !valid) throw new AuthError("Nome de login ou senha incorretos.", 401);
    if (user.status !== "approved") throw new AuthError(user.status === "pending" ? "Seu cadastro aguarda aprovação do administrador." : "Acesso bloqueado. Contate o administrador.", 403);
    if (!user.username) {
      try { await users.updateOne({ _id: user._id, username: { $exists: false } }, { $set: { username } }); }
      catch (error) { if ((error as { code?: number }).code === 11000) throw new AuthError("Nome de login em conflito. Contate o administrador.", 409); throw error; }
      user.username = username;
    }
    await createSession(user);
    return Response.json({ user: publicAccount(user) });
  } catch (error) { return authFailure(error); }
}
