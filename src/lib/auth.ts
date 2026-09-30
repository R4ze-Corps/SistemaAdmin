import { createHash, randomBytes, scrypt as deriveKey, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDatabase } from "./mongodb";

const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  deriveKey(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
const COOKIE = "refugio-session";
const MAX_AGE = 60 * 60 * 24 * 7;
export type Account = { _id: ObjectId; name: string; username?: string; email?: string; passwordHash: string; preferences?: { theme: "light" | "dark" | "system" }; role: "admin" | "member"; status: "pending" | "approved" | "blocked"; createdAt: Date };
export function normalizeLogin(value: unknown) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() : "";
}
export function validLogin(value: string) {
  return value.length >= 3 && value.length <= 50 && /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(value);
}
export function legacyLoginFilter(username: string) {
  return { username: { $exists: false }, name: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } };
}
type Session = { tokenHash: string; userId: ObjectId; expiresAt: Date };
export class AuthError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt);
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, encoded] = hash.split(":");
  if (!salt || !encoded || encoded.length !== 128) return false;
  const key = await scrypt(password, salt);
  return timingSafeEqual(key, Buffer.from(encoded, "hex"));
}
export function publicAccount(user: Account) {
  return { id: user._id.toHexString(), name: user.name, username: user.username ?? user.name, role: user.role, status: user.status, preferences: user.preferences ?? { theme: "system" } };
}
export async function currentAccount() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await getDatabase();
  const session = await db.collection<Session>("auth_sessions").findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return db.collection<Account>("users").findOne({ _id: session.userId, status: "approved" });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new AuthError("Origem da solicitação inválida.", 403);
}
export async function authorize(request?: Request, admin = false) {
  if (request && !["GET", "HEAD"].includes(request.method)) sameOrigin(request);
  const user = await currentAccount();
  if (!user) throw new AuthError("Entre na sua conta para continuar.", 401);
  if (admin && user.role !== "admin") throw new AuthError("Acesso restrito ao administrador.", 403);
  return user;
}
export function authFailure(error: unknown) {
  return Response.json({ message: error instanceof AuthError ? error.message : "Não foi possível concluir a solicitação. Tente novamente." }, { status: error instanceof AuthError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}
export async function createSession(user: Account) {
  const db = await getDatabase();
  await db.collection("auth_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("auth_sessions").createIndex({ tokenHash: 1 }, { unique: true });
  const token = randomBytes(32).toString("hex");
  await db.collection<Session>("auth_sessions").insertOne({ tokenHash: digest(token), userId: user._id, expiresAt: new Date(Date.now() + MAX_AGE * 1000) });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}
export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await (await getDatabase()).collection("auth_sessions").deleteOne({ tokenHash: digest(token) });
  store.delete(COOKIE);
}
export async function revokeOtherSessions(user: Account) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) throw new AuthError("Entre novamente para continuar.", 401);
  return (await getDatabase()).collection("auth_sessions").deleteMany({ userId: user._id, tokenHash: { $ne: digest(token) } });
}
// Atomic, persisted limiter: works across Vercel instances (no in-memory counters).
export async function rateLimit(request: Request, username: string) {
  const db = await getDatabase();
  const collection = db.collection<{ _id: string; count: number; expiresAt: Date }>("auth_limits");
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const window = Math.floor(Date.now() / (15 * 60 * 1000));
  for (const identity of [`ip:${ip}`, `login:${username}`]) {
    const result = await collection.findOneAndUpdate({ _id: digest(`${identity}:${window}`) }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 15 * 60 * 1000) } }, { upsert: true, returnDocument: "after" });
    if ((result?.count ?? 0) > (identity.startsWith("ip:") ? 50 : 10)) throw new AuthError("Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.", 429);
  }
}
