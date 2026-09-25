// Credencial da conta demo nunca pode voltar a ser literal no código:
// o repositório é público. O script gera a senha em runtime ou lê
// CONTA_DEMO_SENHA do ambiente.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "scripts");
const arquivos = [];
(function varrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p);
    else if (/\.(mjs|js|cjs|ts)$/.test(e.name)) arquivos.push(p);
  }
})(scriptsDir);

test("nenhum script contém senha literal (atribuição ou password: \"...\")", () => {
  for (const f of arquivos) {
    const src = fs.readFileSync(f, "utf8");
    const rel = path.relative(root, f);
    assert.doesNotMatch(src, /\b(const|let|var)\s+SENHA\s*=\s*["'`]/, `${rel}: SENHA literal`);
    assert.doesNotMatch(src, /\bpassword\s*:\s*["'`][^"'`]+["'`]/, `${rel}: password literal`);
  }
});

test("criação da conta demo usa CONTA_DEMO_SENHA ou senha aleatória gerada em runtime", () => {
  const src = fs.readFileSync(path.join(scriptsDir, "criar-conta-comercial-demo.mjs"), "utf8");
  assert.match(src, /process\.env\.CONTA_DEMO_SENHA \|\| randomBytes\(18\)\.toString\("base64url"\)/);
  assert.match(src, /password: senha,/);
});
