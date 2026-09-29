// Raio-X da Empresa · bloco "Perfil da Empresa" (correção 2026-09-29).
// app/api/raio-x/route.ts reaproveita nomes antigos do construtor de site
// (has_hero, has_slug, galeria, equipe, servicos, estrutura...) para medir
// OUTRAS coisas. O bloco exibia "Endereço", "WhatsApp" e "Nome" lendo campos
// que não mediam isso (dois sempre 0; um era a instância Z-API). Este teste
// amarra os DOIS lados: o que a API realmente mede em cada campo e o rótulo
// que a tela mostra para ele — se qualquer lado mudar, o teste quebra.
//
// node --test tests/raio-x-perfil.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const api = ler("app/api/raio-x/route.ts");
const pagina = ler("app/raio-x/page.tsx");

test("API: significado real de cada campo usado pelo bloco Perfil da Empresa", () => {
  assert.match(api, /const hasLogo\s+= !!\(clinica\?\.logo_url \|\| config\?\.logo_url\);/);
  assert.match(api, /const hasHero\s+= !!config\?\.email;/, "has_hero = e-mail");
  assert.match(api, /const hasSlug\s+= !!config\?\.link_google;/, "has_slug = link de avaliação do Google");
  assert.match(api, /const nGaleria = \[config\?\.msg_lembrete, config\?\.msg_confirmacao, config\?\.msg_avaliacao, config\?\.msg_reagendamento\]\.filter\(Boolean\)\.length;/, "galeria = modelos de mensagem (0-4)");
  assert.match(api, /const nEquipe = config\?\.telefone \? 1 : 0;/, "equipe = telefone");
  assert.match(api, /const nSrv\s+= config\?\.horario_funcionamento \? 1 : 0;/, "servicos = horário");
  assert.match(api, /const hasZapi\s+= !!\(config\?\.zapi_instance && config\?\.zapi_token\);/);
  assert.match(api, /automacao: \{ has_zapi: hasZapi \}/);
  // Campos que NÃO medem endereço/nome/WhatsApp — nunca podem virar esses rótulos.
  assert.match(api, /const nAntes = 0;/);
  assert.match(api, /const nDep\s+= 0;/);
});

test("Tela: cada rótulo do Perfil da Empresa lê exatamente o campo que mede aquilo", () => {
  const inicio = pagina.indexOf("Perfil da Empresa");
  const bloco = pagina.slice(inicio, pagina.indexOf("].map(item =>", inicio));
  const chips = Object.fromEntries([...bloco.matchAll(/\{ l: "([^"]+)",\s+ok: ([^,}]+?)\s*(?:,|\})/g)].map(m => [m[1], m[2].trim()]));
  assert.deepEqual(chips, {
    "Logo": "metricas.site.has_logo",
    "E-mail": "metricas.site.has_hero",
    "Link de avaliação Google": "metricas.site.has_slug",
    "Mensagens automáticas": "metricas.site.galeria > 0",
    "Telefone": "metricas.site.equipe > 0",
    "Horário": "metricas.site.servicos > 0",
    "WhatsApp": "metricas.automacao.has_zapi",
  });
  // Sem dado consultado, não há indicador: nada de "Endereço"/"Nome" nem campos sempre 0.
  assert.doesNotMatch(bloco, /l: "(Endereço|Nome)"/);
  assert.doesNotMatch(bloco, /metricas\.site\.(depoimentos|antes_depois|estrutura)/);
  const render = pagina.slice(inicio, pagina.indexOf("</div>\n      </div>", pagina.indexOf("].map(item =>", inicio)) + 200);
  assert.match(render, /\{item\.cnt\} de 4 modelos/);
  assert.doesNotMatch(render, /item\{item\.cnt > 1 \? "s" : ""\}/, 'sem "items"');
});

test("Meu Site: acentuação só na apresentação — chave interna do ícone preservada", () => {
  assert.match(ler("app/site/estrutura/page.tsx"), /title="Estrutura do Negócio" subtitle="Ambientes e instalações exibidos no site"/);
  assert.match(ler("lib/catalogo-comercial.ts"), /\{ key: "clinic",\s+emoji: "🏢", label: "Negócio"\s+\}/);
});
