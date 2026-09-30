import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Execute the actual TypeScript helpers with only cookies/database substituted.
let cookie;
let databaseCalls = 0;
function load(relative, imports = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(id => id in imports ? imports[id] : require(id), compiled, compiled.exports);
  return compiled.exports;
}
const auth = load("../src/lib/auth.ts", {
  "next/headers": { cookies: async () => ({ get: () => cookie }) },
  "./mongodb": { getDatabase: async () => { databaseCalls++; throw new Error("Database must not be accessed without a session"); } },
});

test("passwords have random salts and do not contain the plaintext", async () => {
  const password = "Senha de teste longa 123!";
  const first = await auth.hashPassword(password);
  const second = await auth.hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await auth.verifyPassword(password, first), true);
  assert.equal(await auth.verifyPassword("Outra senha longa", first), false);
  assert.equal(await auth.verifyPassword(password, "invalid"), false);
});
test("login normalization is case-insensitive and validates names, not email", () => {
  assert.equal(auth.normalizeLogin("  Kawan   Silva  "), "kawan silva");
  assert.equal(auth.normalizeLogin(null), "");
  assert.equal(auth.validLogin("kawan"), true);
  assert.equal(auth.validLogin("josé silva"), true);
  assert.equal(auth.validLogin("admin_01"), true);
  assert.equal(auth.validLogin("ka"), false);
  assert.equal(auth.validLogin("kawan@example.com"), false);
  assert.equal(auth.validLogin("$admin"), false);
  assert.equal(auth.validLogin("a".repeat(51)), false);
  assert.equal(auth.legacyLoginFilter("kawan.silva").name.$regex, "^kawan\\.silva$");
});
test("writes reject missing and cross-site origins", () => {
  assert.throws(() => auth.sameOrigin(new Request("http://localhost/api/state", { method: "PUT" })), { status: 403 });
  assert.throws(() => auth.sameOrigin(new Request("http://localhost/api/state", { method: "PUT", headers: { origin: "https://evil.example" } })), { status: 403 });
  assert.doesNotThrow(() => auth.sameOrigin(new Request("http://localhost/api/state", { method: "PUT", headers: { origin: "http://localhost" } })));
});
test("no session and malformed tokens are rejected without reading application data", async () => {
  cookie = undefined;
  assert.equal(await auth.currentAccount(), null);
  await assert.rejects(auth.authorize(), { status: 401 });
  cookie = { value: "invalid" };
  assert.equal(await auth.currentAccount(), null);
  assert.equal(databaseCalls, 0);
  cookie = undefined;
});
test("state, users and document routes deny unauthenticated access", async () => {
  const imports = { "@/lib/auth": auth, "@/lib/mongodb": { getDatabase: () => { throw new Error("Unexpected data access"); } } };
  for (const path of ["state", "users", "documents/download", "health", "account"]) {
    const route = load(`../src/app/api/${path}/route.ts`, imports);
    const response = await route.GET(new Request(`http://localhost/api/${path}`));
    assert.equal(response.status, 401, path);
  }
  for (const [path, method] of [["state", "PUT"], ["users", "PATCH"], ["documents", "DELETE"], ["account", "PATCH"]]) {
    const route = load(`../src/app/api/${path}/route.ts`, imports);
    const response = await route[method](new Request(`http://localhost/api/${path}`, { method, headers: { origin: "http://localhost" } }));
    assert.equal(response.status, 401, path);
  }
});
test("unexpected server errors do not expose database secrets", async () => {
  const response = auth.authFailure(new Error("mongodb://user:secret@server"));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("secret"), false);
});
// Transactional Mongo fixture: no real database writes or administrator account.
function registrationFixture(initial = []) {
  const stored = [...initial];
  let lock = null;
  let queue = Promise.resolve();
  let failInsert = false;
  const users = {
    createIndex: async () => "index",
    listIndexes: () => ({ toArray: async () => [] }),
    findOne: async filter => stored.find(user => filter.role ? user.role === filter.role : user.username === (filter.username || filter.$or?.[0]?.username)) || null,
    find: () => ({ limit: () => ({ toArray: async () => [] }) }),
    insertOne: async user => {
      if (failInsert) { failInsert = false; throw new Error("simulated insert failure"); }
      if (stored.some(item => item.username === user.username)) throw Object.assign(new Error("duplicate"), { code: 11000 });
      stored.push(user);
    },
  };
  const bootstrap = {
    updateOne: async (_filter, update) => { if (!lock) lock = { _id: "administrator", administratorId: null, revision: 0 }; Object.assign(lock, update.$set); },
    findOneAndUpdate: async () => { lock.revision++; return { ...lock }; },
  };
  const db = { collection: name => name === "auth_bootstrap" ? bootstrap : users };
  const client = { startSession: () => ({
    withTransaction: async callback => {
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      const original = stored.map(user => ({ ...user }));
      const originalLock = { ...lock };
      try { return await callback(); }
      catch (error) { stored.splice(0, stored.length, ...original); lock = originalLock; throw error; }
      finally { release(); }
    },
    endSession: async () => {},
  }) };
  const mongodb = { getDatabase: async () => db, getMongoClient: async () => client };
  const registration = load("../src/lib/register-account.ts", { "./auth": auth, "./mongodb": mongodb });
  return { stored, mongodb, registration, failNextInsert: () => { failInsert = true; } };
}
const makeAccount = username => ({ _id: new (require("mongodb").ObjectId)(), name: username, username, passwordHash: "salt:hashed-password", role: "member", status: "pending", createdAt: new Date() });
test("first registration becomes admin and later registrations require approval, without env", async () => {
  const fixture = registrationFixture();
  let sessionUser;
  const route = load("../src/app/api/auth/[action]/route.ts", {
    "@/lib/mongodb": fixture.mongodb,
    "@/lib/register-account": fixture.registration,
    "@/lib/auth": { ...auth, rateLimit: async () => {}, hashPassword: async () => "salt:hashed-password", verifyPassword: async (password, hash) => password === "Teste123" && hash === "salt:hashed-password", createSession: async user => { sessionUser = user; } },
  });
  const post = (action, body) => route.POST(new Request(`http://localhost/api/auth/${action}`, { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ action }) });
  const setup = () => route.GET(new Request("http://localhost/api/auth/setup"), { params: Promise.resolve({ action: "setup" }) });
  assert.equal((await (await setup()).json()).needsAdministrator, true);
  for (const password of ["", "123", "123456789"]) assert.equal((await post("register", { name: "Limite", username: "limite", password })).status, 400);
  const result = await post("register", { name: "Kawan", username: " KAWAN ", password: "Teste123", role: "member" });
  assert.equal(result.status, 201);
  assert.equal((await result.json()).pending, false);
  assert.equal(fixture.stored[0].role, "admin");
  assert.equal(fixture.stored[0].status, "approved");
  assert.equal(fixture.stored[0].username, "kawan");
  assert.equal("password" in fixture.stored[0], false);
  assert.equal("email" in fixture.stored[0], false);
  assert.equal(sessionUser, fixture.stored[0]);
  const configured = await (await setup()).json();
  assert.deepEqual(configured, { needsAdministrator: false });
  assert.equal((await post("register", { name: "Outro", username: "KAWAN", password: "Teste123" })).status, 409);
  assert.equal((await post("register", { name: "Membro", username: "membro", password: "1234", role: "admin", status: "approved" })).status, 201);
  assert.equal(fixture.stored[1].role, "member");
  assert.equal(fixture.stored[1].status, "pending");
  assert.equal((await post("login", { username: "membro", password: "Teste123" })).status, 403);
  fixture.stored[1].status = "approved";
  const login = await post("login", { username: "MEMBRO", password: "Teste123" });
  assert.equal(login.status, 200);
  assert.equal("passwordHash" in (await login.json()).user, false);
  assert.equal((await post("login", { username: "kawan", password: "Senha incorreta longa" })).status, 401);
  assert.equal((await post("register", { name: "Limite", username: "limite", password: "12345678" })).status, 201);
});
test("simultaneous first registrations create exactly one administrator", async () => {
  const fixture = registrationFixture();
  await Promise.all(["primeiro", "segundo", "terceiro"].map(username => fixture.registration.registerAccount(makeAccount(username))));
  assert.equal(fixture.stored.filter(user => user.role === "admin").length, 1);
  assert.equal(fixture.stored.filter(user => user.status === "pending").length, 2);
});
test("failed first registration rolls back the claim and allows a later administrator", async () => {
  const fixture = registrationFixture();
  fixture.failNextInsert();
  await assert.rejects(fixture.registration.registerAccount(makeAccount("falhou")), /simulated/);
  assert.equal(fixture.stored.length, 0);
  await fixture.registration.registerAccount(makeAccount("sucesso"));
  assert.equal(fixture.stored[0].role, "admin");
});
test("an existing administrator is preserved, including when blocked", async () => {
  const existing = { ...makeAccount("existente"), role: "admin", status: "blocked" };
  const fixture = registrationFixture([existing]);
  await fixture.registration.registerAccount(makeAccount("novo"));
  assert.equal(fixture.stored[0], existing);
  assert.equal(fixture.stored[1].role, "member");
  assert.equal(fixture.stored[1].status, "pending");
});
test("account settings validate profile, persist theme, and protect password changes", async () => {
  const user = { ...makeAccount("usuario"), status: "approved" };
  let conflict = false;
  let revoked = false;
  let recreated = false;
  let otherRevoked = false;
  const users = {
    createIndex: async () => {},
    findOne: async () => conflict ? makeAccount("ocupado") : null,
    updateOne: async (_filter, update) => { Object.assign(user, update.$set); return { matchedCount: 1 }; },
  };
  const sessions = { countDocuments: async () => 3, deleteMany: async () => { revoked = true; } };
  const route = load("../src/app/api/account/route.ts", {
    "@/lib/mongodb": { getDatabase: async () => ({ collection: name => name === "users" ? users : sessions }) },
    "@/lib/auth": { ...auth, authorize: async () => ({ ...user }), rateLimit: async () => {}, verifyPassword: async password => password === "1234", hashPassword: async () => "new-password-hash", createSession: async () => { recreated = true; }, revokeOtherSessions: async () => { otherRevoked = true; } },
  });
  const patch = body => route.PATCH(new Request("http://localhost/api/account", { method: "PATCH", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) }));
  assert.equal((await (await route.GET()).json()).activeSessions, 3);
  assert.equal((await patch({ action: "preferences", theme: "invalid" })).status, 400);
  assert.equal((await patch({ action: "preferences", theme: "dark", role: "admin" })).status, 200);
  assert.equal(user.preferences.theme, "dark");
  assert.equal(user.role, "member");
  assert.equal((await patch({ action: "profile", name: "Novo Nome", username: "usuario" })).status, 200);
  assert.equal(user.name, "Novo Nome");
  assert.equal((await patch({ action: "profile", name: "Nome", username: "novo", currentPassword: "errada" })).status, 403);
  assert.equal(user.username, "usuario");
  conflict = true;
  assert.equal((await patch({ action: "profile", name: "Nome", username: "ocupado", currentPassword: "1234" })).status, 409);
  conflict = false;
  assert.equal((await patch({ action: "profile", name: "Nome", username: "NOVO", currentPassword: "1234" })).status, 200);
  assert.equal(user.username, "novo");
  assert.equal((await patch({ action: "password", currentPassword: "1234", password: "123" })).status, 400);
  assert.equal((await patch({ action: "password", currentPassword: "errada", password: "5678" })).status, 403);
  assert.equal(user.passwordHash, "salt:hashed-password");
  assert.equal((await patch({ action: "password", currentPassword: "1234", password: "5678" })).status, 200);
  assert.equal(user.passwordHash, "new-password-hash");
  assert.equal(revoked && recreated, true);
  const response = await patch({ action: "sessions" });
  assert.equal(response.status, 200);
  assert.equal(otherRevoked, true);
  assert.equal("passwordHash" in (await response.json()).user, false);
});
