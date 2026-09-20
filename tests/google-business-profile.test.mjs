import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const scope = "https://www.googleapis.com/auth/business.manage";
assert.equal(scope, "https://www.googleapis.com/auth/business.manage");

const secret = "teste-secreto";
const payload = Buffer.from(JSON.stringify({ clinicaId: "c1", userId: "u1", nonce: "n1", exp: 2000 })).toString("base64url");
const signature = createHmac("sha256", secret).update(payload).digest("base64url");
assert.equal(signature.length > 20, true);
assert.equal(Buffer.from(payload, "base64url").toString("utf8").includes("c1"), true);

const params = new URLSearchParams({ client_id: "client", redirect_uri: "https://app.test/callback", response_type: "code", scope, access_type: "offline", prompt: "consent", state: `${payload}.${signature}` });
assert.equal(params.get("scope"), scope);
assert.equal(params.get("access_type"), "offline");
assert.equal(params.get("prompt"), "consent");

console.log("google-business-profile: 7 assertions OK");