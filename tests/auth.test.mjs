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
test("bootstrap key comparison rejects different secrets", () => {
  assert.equal(auth.secretMatches("a".repeat(32), "a".repeat(32)), true);
  assert.equal(auth.secretMatches("b", "a".repeat(32)), false);
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
  for (const path of ["state", "users", "documents/download", "health"]) {
    const route = load(`../src/app/api/${path}/route.ts`, imports);
    const response = await route.GET(new Request(`http://localhost/api/${path}`));
    assert.equal(response.status, 401, path);
  }
  for (const [path, method] of [["state", "PUT"], ["users", "PATCH"], ["documents", "DELETE"]]) {
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
test("username registration persists account data and login respects approval", async () => {
  const previousLogin = process.env.ADMIN_LOGIN;
  const previousKey = process.env.ADMIN_SETUP_KEY;
  process.env.ADMIN_LOGIN = "administrador";
  process.env.ADMIN_SETUP_KEY = "s".repeat(32);
  const stored = [];
  let sessionUser;
  const users = {
    createIndex: async () => "index",
    listIndexes: () => ({ toArray: async () => [] }),
    findOne: async filter => stored.find(user => user.username === (filter.username || filter.$or?.[0]?.username)) || null,
    find: () => ({ limit: () => ({ toArray: async () => [] }) }),
    insertOne: async user => { stored.push(user); },
  };
  const route = load("../src/app/api/auth/[action]/route.ts", {
    "@/lib/mongodb": { getDatabase: async () => ({ collection: () => users }) },
    "@/lib/auth": { ...auth, rateLimit: async () => {}, hashPassword: async () => "salt:hashed-password", verifyPassword: async (password, hash) => password === "Senha longa 123!" && hash === "salt:hashed-password", createSession: async user => { sessionUser = user; } },
  });
  const post = (action, body) => route.POST(new Request(`http://localhost/api/auth/${action}`, { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ action }) });
  try {
    const result = await post("register", { name: "Kawan", username: " KAWAN ", password: "Senha longa 123!" });
    assert.equal(result.status, 201);
    assert.equal((await result.json()).pending, true);
    assert.equal(stored[0].username, "kawan");
    assert.equal(stored[0].name, "Kawan");
    assert.equal(stored[0].passwordHash, "salt:hashed-password");
    assert.equal("password" in stored[0], false);
    assert.equal("email" in stored[0], false);
    assert.equal(sessionUser, undefined);
    assert.equal((await post("register", { name: "Outro Kawan", username: "KAWAN", password: "Senha longa 123!" })).status, 409);
    assert.equal((await post("login", { username: "kawan", password: "Senha longa 123!" })).status, 403);
    stored[0].status = "approved";
    const login = await post("login", { username: "Kawan", password: "Senha longa 123!" });
    assert.equal(login.status, 200);
    const data = await login.json();
    assert.equal(data.user.username, "kawan");
    assert.equal("passwordHash" in data.user, false);
    assert.equal(sessionUser, stored[0]);
    assert.equal((await post("login", { username: "kawan", password: "Senha incorreta longa" })).status, 401);
    assert.equal((await post("register", { name: "Admin", username: "administrador", password: "Senha longa 123!", setupKey: "errada" })).status, 403);
    assert.equal((await post("register", { name: "Admin", username: "administrador", password: "Senha longa 123!", setupKey: "s".repeat(32) })).status, 201);
    assert.equal(stored[1].role, "admin");
  } finally {
    if (previousLogin === undefined) delete process.env.ADMIN_LOGIN; else process.env.ADMIN_LOGIN = previousLogin;
    if (previousKey === undefined) delete process.env.ADMIN_SETUP_KEY; else process.env.ADMIN_SETUP_KEY = previousKey;
  }
});
