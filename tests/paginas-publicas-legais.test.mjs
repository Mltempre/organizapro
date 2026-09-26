// Pré-validação pública para a solicitação de acesso às APIs do Google
// Business Profile (missão 2026-09-26): /privacidade e /termos precisam existir
// publicamente (antes: 404), com contato oficial, e a Política precisa
// descrever a integração Google exatamente como o código a implementa.
//
// node --test tests/paginas-publicas-legais.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const privacidade = ler("app/privacidade/page.tsx");
const termos = ler("app/termos/page.tsx");
const documento = ler("app/components/legal/DocumentoLegal.tsx");
const rodape = ler("app/components/landing/LandingFooter.tsx");
const shell = ler("app/components/AdminShellFrame.tsx");
const EMAIL = "contato@organizaprooficial.com.br";

test("rotas públicas existem e ficam fora do shell autenticado", () => {
  assert.match(privacidade, /export default function PoliticaDePrivacidadePage\(\)/);
  assert.match(termos, /export default function TermosDeUsoPage\(\)/);
  for (const rota of ["/privacidade", "/termos"]) assert.ok(!shell.includes(`"${rota}"`), `${rota} não pode entrar em ROTAS_COM_SHELL`);
  for (const fonte of [privacidade, termos, documento]) {
    assert.doesNotMatch(fonte, /^"use client"/m, "documentos públicos renderizam no servidor (conteúdo no HTML inicial)");
    assert.doesNotMatch(fonte, /supabase|fetch\(|process\.env/, "página pública não consulta dados nem ambiente");
  }
});

test("contato oficial publicado nos documentos e no rodapé da landing", () => {
  assert.ok(documento.includes(`export const EMAIL_CONTATO = "${EMAIL}"`));
  assert.match(documento, /href=\{`mailto:\$\{EMAIL_CONTATO\}`\}/);
  assert.match(privacidade, /<EmailContato \/>/);
  assert.match(termos, /<EmailContato \/>/);
  assert.doesNotMatch(privacidade + termos, /canais oficiais da OrganizaPro\*\*/, "contato genérico do V1 substituído pelo e-mail");
  assert.match(rodape, /import \{ EMAIL_CONTATO \} from "\.\.\/legal\/DocumentoLegal"/);
  assert.match(rodape, /<Link href="\/privacidade"[^>]*>\s*Política de Privacidade\s*<\/Link>/);
  assert.match(rodape, /<Link href="\/termos"[^>]*>\s*Termos de Uso\s*<\/Link>/);
  assert.match(rodape, /href=\{`mailto:\$\{EMAIL_CONTATO\}`\}/);
  assert.match(rodape, /flexWrap: "wrap"/, "rodapé quebra linha no celular");
});

test("Política: seção Google cobre dados, finalidade, OAuth, armazenamento, IA, Uso Limitado e revogação", () => {
  const google = privacidade.slice(privacidade.indexOf('titulo="4. Integração com o Google Business Profile"'), privacidade.indexOf('titulo="5. '));
  assert.ok(google.length > 1000, "seção 4 presente");
  for (const trecho of ["OAuth 2.0", "business.manage", "nunca recebe nem armazena a sua senha do Google",
    "avaliações do perfil", "métricas de desempenho", "Nenhuma resposta é publicada automaticamente",
    "OpenAI", "O nome do avaliador não é enviado", "não utiliza dados obtidos do Google para treinar",
    "criptografada (AES-256-GCM)", "não são armazenadas de forma permanente",
    "https://developers.google.com/terms/api-services-user-data-policy", "Uso Limitado",
    "“Desconectar”", "https://myaccount.google.com/permissions"]) {
    assert.ok(google.includes(trecho), `seção Google deveria conter: ${trecho}`);
  }
});

test("Política afirma só o que o código faz (fatos conferidos na fonte)", () => {
  const scope = ler("lib/google-business-profile.ts");
  assert.ok(scope.includes('GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage"'), "escopo único business.manage");
  assert.ok(scope.includes('createCipheriv("aes-256-gcm"'), "refresh token cifrado com AES-256-GCM");
  const prompt = ler("lib/google-business-profile-shared.ts");
  assert.doesNotMatch(prompt.slice(prompt.indexOf("export function montarPromptRespostaAvaliacao")), /autor|reviewer/i, "IA não recebe nome do avaliador");
  assert.ok(ler("app/api/ia/route.ts").includes("https://api.openai.com/"), "provedor de IA é a OpenAI");
  assert.ok(ler("lib/google-business-profile-handlers.ts").includes('.from("google_business_profile_connections").delete()'), "Desconectar remove a conexão");
});

test("Termos preservam as 10 seções do V1 e nenhum documento expõe segredo", () => {
  for (const s of ["1. Apresentação", "2. Aceitação", "3. Acesso à plataforma", "4. Utilização", "5. Disponibilidade",
    "6. Atualizações", "7. Propriedade intelectual", "8. Encerramento do uso", "9. Alterações destes termos", "10. Contato"]) {
    assert.ok(termos.includes(`titulo="${s}"`), `seção ${s}`);
  }
  assert.ok(termos.includes('<Link href="/privacidade"'));
  for (const fonte of [privacidade, termos, documento, rodape]) {
    assert.doesNotMatch(fonte, /sk-[A-Za-z0-9]{10,}|ya29\.|eyJ[A-Za-z0-9_-]{20,}|SERVICE_ROLE|CLIENT_SECRET|TOKEN_KEY/, "sem segredo ou nome de credencial");
  }
});
