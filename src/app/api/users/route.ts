import { ObjectId } from "mongodb";
import { Account, AuthError, authFailure, authorize, publicAccount } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
export const runtime = "nodejs";
export async function GET() {
  try {
    await authorize(undefined, true);
    const users = await (await getDatabase()).collection<Account>("users").find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).limit(500).toArray();
    return Response.json({ users: users.map(publicAccount) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await authorize(request, true);
    if (user.preferences?.betaEnabled) throw new AuthError("Desative o Modo Beta para alterar contas reais.", 409);
    const body = await request.json();
    if (typeof body.id !== "string" || !ObjectId.isValid(body.id) || !["approved", "blocked"].includes(body.status)) throw new AuthError("Dados inválidos.", 400);
    const db = await getDatabase();
    const result = await db.collection<Account>("users").updateOne({ _id: new ObjectId(body.id), role: "member" }, { $set: { status: body.status } });
    if (!result.matchedCount) throw new AuthError("Conta não encontrada ou protegida.", 404);
    if (body.status === "blocked") await db.collection("auth_sessions").deleteMany({ userId: new ObjectId(body.id) });
    return Response.json({ ok: true });
  } catch (error) { return authFailure(error); }
}
