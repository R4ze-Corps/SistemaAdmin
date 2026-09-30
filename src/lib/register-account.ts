import { ObjectId } from "mongodb";
import { Account, AuthError, legacyLoginFilter } from "./auth";
import { getDatabase, getMongoClient } from "./mongodb";

type Bootstrap = { _id: string; administratorId: ObjectId | null; revision: number };

// The singleton is locked inside the same transaction that creates the account.
// A failed registration rolls back both changes; competing signups retry safely.
export async function registerAccount(user: Account) {
  const db = await getDatabase();
  const users = db.collection<Account>("users");
  const bootstrap = db.collection<Bootstrap>("auth_bootstrap");
  try {
    await bootstrap.updateOne({ _id: "administrator" }, { $setOnInsert: { administratorId: null, revision: 0 } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const session = (await getMongoClient()).startSession();
  try {
    await session.withTransaction(async () => {
      const lock = await bootstrap.findOneAndUpdate({ _id: "administrator" }, { $inc: { revision: 1 } }, { session, returnDocument: "after" });
      if (!lock) throw new Error("Administrator bootstrap unavailable");
      if (await users.findOne({ $or: [{ username: user.username }, legacyLoginFilter(user.username!)] }, { session })) throw new AuthError("Este nome de login já está em uso.", 409);
      const administrator = await users.findOne({ role: "admin" }, { session });
      const first = !administrator && lock.administratorId === null;
      if (!administrator && !first) throw new AuthError("A configuração do administrador precisa ser verificada pelo responsável do banco.", 409);
      user.role = first ? "admin" : "member";
      user.status = first ? "approved" : "pending";
      await users.insertOne(user, { session });
      await bootstrap.updateOne({ _id: "administrator" }, { $set: { administratorId: administrator?._id ?? user._id } }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    return user;
  } finally { await session.endSession(); }
}
