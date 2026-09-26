// Identidade: o WhatsApp oficial do OrganizaPro é (43) 98412-8591, confirmado
// pelo responsável em 2026-09-26. A landing, o blog e o chatbot SDR usavam o
// número (41) 98837-9119, que pertence à ClínicaFlow.
//
// Regra: uma fonte única (app/components/landing/whatsapp.ts). Documentos
// históricos (docs/contrato-v1.md) e fixtures de normalização de telefone
// (tests/whatsapp-governado.test.mjs) não são superfície ativa e ficam fora.
//
// node --test tests/whatsapp-oficial-organizapro.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = p => fs.readFileSync(path.join(root, p), "utf8");
const fonte = ler("app/components/landing/whatsapp.ts");

function arquivos(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? arquivos(path.join(dir, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

test("fonte única: constante canônica com o número oficial (43)", () => {
  assert.match(fonte, /export const NUMERO_COMERCIAL = "5543984128591";/);
  assert.match(fonte, /export const NUMERO_COMERCIAL_EXIBICAO = "43 98412-8591";/);
  assert.match(fonte, /wa\.me\/\$\{NUMERO_COMERCIAL\}/, "links usam a constante");
});

test("nenhuma superfície ativa (app/ e lib/) contém o número da ClínicaFlow", () => {
  for (const arquivo of [...arquivos("app"), ...arquivos("lib")]) {
    assert.doesNotMatch(ler(arquivo), /98837[-\s]?9119|4198837|988379119/, `${arquivo} ainda usa o número da ClínicaFlow`);
  }
});

test("landing, blog e chatbot SDR leem a fonte única (sem número literal concorrente)", () => {
  for (const cta of ["app/page.tsx", "app/components/landing/Oferta.tsx", "app/components/landing/CtaFinal.tsx", "app/components/landing/LandingFooter.tsx"]) {
    assert.match(ler(cta), /from "\.\/(components\/landing\/)?whatsapp"/, `${cta} importa whatsapp.ts`);
  }
  const blog = ler("app/blog/data/articles.ts");
  assert.match(blog, /import \{ NUMERO_COMERCIAL \} from "\.\.\/\.\.\/components\/landing\/whatsapp";/);
  assert.match(blog, /export const WPP_NUMBER = NUMERO_COMERCIAL;/);
  const chatbot = ler("app/api/chatbot/message/route.ts");
  assert.match(chatbot, /import \{ NUMERO_COMERCIAL_EXIBICAO \} from "\.\.\/\.\.\/\.\.\/components\/landing\/whatsapp";/);
  assert.equal((chatbot.match(/📱 WhatsApp: \$\{NUMERO_COMERCIAL_EXIBICAO\}/g) ?? []).length, 3, "3 mensagens do SDR");
  for (const arquivo of [...arquivos("app"), ...arquivos("lib")].filter(a => !a.endsWith(path.join("landing", "whatsapp.ts")))) {
    assert.doesNotMatch(ler(arquivo), /5543984128591|98412-8591/, `${arquivo} não deve repetir o número fora da fonte única`);
  }
});
