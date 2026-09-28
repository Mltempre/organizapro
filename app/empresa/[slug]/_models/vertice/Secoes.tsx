import Reveal from "../../_components/Reveal";
import { Icon, IcWa, IcPhone, IcStarFilled } from "../../_components/icons";
import {
  gerarTituloSobre, gerarTituloGaleria, gerarTituloServicos,
  gerarTituloDepoimentos, gerarTituloContato, initials,
} from "../../_lib/helpers";
import { CTA_CONTEXTUAL, DIFERENCIAIS, PROCESSO, PROBLEMA } from "../../_lib/content";
import { paleta, type FamiliaId, type Tema, type Tone } from "../../_lib/families";
import type {
  DBGaleria, DBEstrutura, DBAntes, DBServico, DBDepoimento, DBEquipe, DBFaq, Empresa,
} from "../../_lib/types";
import { construirLinkComRastreio } from "../../../../../lib/atribuicao-origem";
import type { SiteNavItem } from "../../_components/Header";

// ── Seções VÉRTICE ────────────────────────────────────────────────────────
// Composição institucional: nada de cartões arredondados. Sobre em duas
// colunas com ficha técnica, princípios e serviços como ÍNDICE numerado
// (linhas de fio), galeria em pranchas com legenda fora da imagem, prova
// social em citação editorial e FAQ em lista de definição nativa (<details>).
// Todos os itens vêm de dado real; quando o dado não existe, a linha some —
// nenhum texto, preço ou nome é inventado.
//
// Cada seção define as cores da PRÓPRIA paleta (tone/variant) dentro de um
// seletor escopado na própria section: como as três seções podem estar em
// polos diferentes, uma classe compartilhada de cor trocaria o acento da
// seção errada. Só a FORMA (`.v-label`) é compartilhada e sem cor.

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numeroDaNota(nota: number): string {
  return String(nota).replace(".", ",");
}

export function SobreVertice({ empresa, nome, sobre, tema, tone = "light", variant = 1 }: { empresa: Empresa; nome: string; sobre: string[]; tema: Tema; tone?: Tone; variant?: 1 | 2 }) {
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const ficha: [string, string][] = [
    empresa.especialidade ? ["Atuação", empresa.especialidade] : null,
    local ? ["Base", local] : null,
    empresa.endereco ? ["Endereço", empresa.endereco] : null,
    empresa.horario_funcionamento ? ["Atendimento", empresa.horario_funcionamento] : null,
    empresa.nota_google ? ["Google", `${String(empresa.nota_google).replace(".", ",")}${empresa.num_avaliacoes ? ` · ${empresa.num_avaliacoes} avaliações` : ""}`] : null,
  ].filter(Boolean) as [string, string][];

  return <section id="sobre" className="vertice-about"><Reveal><div className="vertice-about__inner">
    <div className="vertice-about__lead">
      <span className="v-label">Sobre</span>
      <h2>{gerarTituloSobre(empresa)}</h2>
      <div className="vertice-about__text">{sobre.map((t, i) => <p key={i}>{t}</p>)}</div>
      {empresa.logo_url && <div className="vertice-about__logo"><img src={empresa.logo_url} alt={nome}/></div>}
    </div>
    {ficha.length > 0 && <dl className="vertice-about__ficha">
      {ficha.map(([rotulo, valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}
    </dl>}
  </div></Reveal><style>{`
    .vertice-about{background:${p.bg};padding:104px 24px}
    .vertice-about__inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:72px;align-items:start}
    .vertice-about .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-about h2{margin:22px 0 30px;font-family:${font.display};font-weight:600;font-size:clamp(30px,3.7vw,48px);line-height:1.12;color:${p.text};max-width:640px;text-wrap:balance}
    .vertice-about__text{max-width:640px;border-top:1px solid ${p.line};padding-top:26px}
    .vertice-about__text p{margin:0 0 16px;font-family:${font.body};font-size:16px;line-height:1.85;color:${p.textMuted};overflow-wrap:anywhere}
    .vertice-about__text p:first-child{color:${p.text};font-size:18.5px;line-height:1.65}
    .vertice-about__logo{margin-top:30px;padding:24px;border:1px solid ${p.line};display:inline-flex;align-items:center;justify-content:center;min-width:220px}
    .vertice-about__logo img{max-width:100%;max-height:96px;object-fit:contain}
    .vertice-about__ficha{margin:6px 0 0;border-top:1px solid ${tema.contrast};padding-top:0}
    .vertice-about__ficha>div{display:grid;gap:6px;padding:18px 0;border-bottom:1px solid ${p.line}}
    .vertice-about__ficha dt{font-family:${font.body};font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${p.textMuted}}
    .vertice-about__ficha dd{margin:0;font-family:${font.body};font-size:15px;font-weight:600;line-height:1.55;color:${p.text};overflow-wrap:anywhere}
    @media(max-width:900px){.vertice-about{padding:84px 20px}.vertice-about__inner{grid-template-columns:1fr;gap:40px}}
  `}</style></section>;
}

// ── Problema ──────────────────────────────────────────────────────────────
// Fala do visitante antes da empresa: rótulo em coluna estreita à esquerda,
// texto em coluna larga à direita — a abertura editorial do modelo. O convite
// é um fio sublinhado (nunca um botão), porque o gesto aqui é ler, não clicar.
export function ProblemaVertice({ familiaId, tema, ctaHref, ctaTexto, tone = "light", variant = 1 }: {
  familiaId: FamiliaId; tema: Tema; ctaHref: string; ctaTexto: string; tone?: Tone; variant?: 1 | 2;
}) {
  const conteudo = PROBLEMA[familiaId];
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section className="vertice-problem"><Reveal><div className="vertice-problem__inner">
    <div className="vertice-problem__aside"><span className="v-label">O que você precisa saber</span></div>
    <div className="vertice-problem__body">
      <h2>{conteudo.titulo}</h2>
      <p>{conteudo.corpo}</p>
      {ctaHref && <a className="vertice-problem__cta" href={ctaHref} target="_blank" rel="noreferrer">{ctaTexto}<span aria-hidden="true">→</span></a>}
    </div>
  </div></Reveal><style>{`
    .vertice-problem{background:${p.bg};padding:112px 24px}
    .vertice-problem__inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.3fr) minmax(0,1fr);gap:56px;align-items:start}
    .vertice-problem .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-problem h2{margin:0 0 28px;font-family:${font.display};font-weight:600;font-size:clamp(28px,3.4vw,42px);line-height:1.16;color:${p.text};max-width:780px;text-wrap:balance}
    .vertice-problem__body p{margin:0 0 30px;font-family:${font.body};font-size:16.5px;line-height:1.85;color:${p.textMuted};max-width:720px;overflow-wrap:anywhere}
    .vertice-problem__cta{display:inline-flex;align-items:center;gap:9px;padding-bottom:3px;border-bottom:1px solid ${p.accent};color:${p.accent};text-decoration:none;font-family:${font.body};font-size:13.5px;font-weight:700;transition:gap .18s}
    .vertice-problem__cta:hover{gap:14px}
    @media(max-width:900px){.vertice-problem{padding:86px 20px}.vertice-problem__inner{grid-template-columns:1fr;gap:18px}}
  `}</style></section>;
}

// ── Princípios ────────────────────────────────────────────────────────────
// Índice editorial: coluna de abertura fixa + linhas numeradas separadas por
// fios. Zero cartão, zero raio — a hierarquia vem do número e do fio.
export function DiferenciaisVertice({ familiaId, tema, tone = "light", variant = 1 }: {
  familiaId: FamiliaId; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const itens = DIFERENCIAIS[familiaId];
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section className="vertice-principles"><Reveal><div className="vertice-principles__inner">
    <header className="vertice-principles__head">
      <span className="v-label">Por que escolher</span>
      <h2>Uma experiência simples, clara e bem cuidada.</h2>
      <p>Princípios que orientam cada contato, do primeiro atendimento à entrega.</p>
    </header>
    <ol className="vertice-principles__list">
      {itens.map((item, i) => <li key={item.titulo}>
        <span className="vertice-principles__no">{String(i + 1).padStart(2, "0")}</span>
        <div><h3>{item.titulo}</h3><p>{item.desc}</p></div>
      </li>)}
    </ol>
  </div></Reveal><style>{`
    .vertice-principles{background:${p.bg};padding:112px 24px}
    .vertice-principles__inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.75fr) minmax(0,1.25fr);gap:72px;align-items:start}
    .vertice-principles .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-principles h2{margin:22px 0 20px;font-family:${font.display};font-weight:600;font-size:clamp(26px,3.1vw,38px);line-height:1.16;color:${p.text};text-wrap:balance}
    .vertice-principles__head>p{margin:0;font-family:${font.body};font-size:15.5px;line-height:1.8;color:${p.textMuted};max-width:380px;overflow-wrap:anywhere}
    .vertice-principles__list{margin:0;padding:0;list-style:none;border-top:1px solid ${p.line}}
    .vertice-principles__list>li{display:grid;grid-template-columns:56px minmax(0,1fr);gap:22px;padding:28px 0;border-bottom:1px solid ${p.line}}
    .vertice-principles__no{font-family:${font.display};font-size:14px;font-weight:600;color:${p.accent};padding-top:4px}
    .vertice-principles__list h3{margin:0 0 8px;font-family:${font.body};font-size:17.5px;font-weight:700;line-height:1.4;color:${p.text};overflow-wrap:anywhere}
    .vertice-principles__list p{margin:0;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};max-width:560px;overflow-wrap:anywhere}
    @media(max-width:980px){.vertice-principles__inner{grid-template-columns:1fr;gap:34px}}
    @media(max-width:700px){.vertice-principles{padding:88px 20px}.vertice-principles__list>li{grid-template-columns:38px minmax(0,1fr);gap:14px;padding:22px 0}}
  `}</style></section>;
}

// ── Como funciona ─────────────────────────────────────────────────────────
// Método em três colunas separadas por fios verticais e numeral grande em
// serif — o oposto do carrossel de cartões: aqui o visitante lê o método como
// um quadro, não como uma sequência de caixas.
export function ProcessoVertice({ familiaId, tema, tone = "dark", variant = 1 }: {
  familiaId: FamiliaId; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const passos = PROCESSO[familiaId];
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section className="vertice-process"><Reveal><div className="vertice-process__inner">
    <header className="vertice-process__head">
      <span className="v-label">Como funciona</span>
      <h2>Do primeiro contato ao resultado</h2>
    </header>
    <ol className="vertice-process__steps">
      {passos.map((passo, i) => <li className="vertice-step" key={i}>
        <span className="vertice-step__no">{passo.numero}</span>
        <h3>{passo.titulo}</h3>
        <p>{passo.desc}</p>
      </li>)}
    </ol>
  </div></Reveal><style>{`
    .vertice-process{background:${p.bg};padding:112px 24px}
    .vertice-process__inner{max-width:1240px;margin:0 auto}
    .vertice-process .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-process__head{display:grid;grid-template-columns:minmax(0,.3fr) minmax(0,1fr);gap:56px;align-items:baseline;margin-bottom:54px}
    .vertice-process h2{margin:0;font-family:${font.display};font-weight:600;font-size:clamp(26px,3.1vw,38px);line-height:1.16;color:${p.text};text-wrap:balance}
    .vertice-process__steps{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0}
    .vertice-step{padding:30px 34px 8px;border-left:1px solid ${p.line}}
    .vertice-step:first-child{border-left:0;padding-left:0}
    .vertice-step__no{display:block;font-family:${font.display};font-size:clamp(30px,3.4vw,44px);font-weight:600;line-height:1;color:${p.accent};margin-bottom:22px}
    .vertice-step h3{margin:0 0 10px;font-family:${font.body};font-size:17px;font-weight:700;line-height:1.4;color:${p.text};overflow-wrap:anywhere}
    .vertice-step p{margin:0;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};max-width:300px;overflow-wrap:anywhere}
    @media(max-width:900px){
      .vertice-process{padding:88px 20px}
      .vertice-process__head{grid-template-columns:1fr;gap:16px;margin-bottom:34px}
      .vertice-process__steps{grid-template-columns:1fr;gap:0}
      .vertice-step{padding:26px 0 0;border-left:0;border-top:1px solid ${p.line}}
      .vertice-step:first-child{border-top:0;padding-top:0}
      .vertice-step__no{margin-bottom:14px}
    }
  `}</style></section>;
}

// ── Serviços ──────────────────────────────────────────────────────────────
// ÍNDICE numerado, não grade de cartões: cada serviço é uma linha com fio,
// nome, descrição, preço público quando cadastrado e uma via direta de
// contato. A imagem do serviço entra como prancha pequena à direita (nunca um
// fundo que come a linha de texto). Item pausado (disponivel === false)
// desaparece; preço e link nunca são inventados.
export function ServicosVertice({ servicos, empresa, tema, familiaId, waBase, codigoRastreio, tone = "light", variant = 2 }: {
  servicos: DBServico[]; empresa: Empresa; tema: Tema; familiaId: FamiliaId; waBase?: string; codigoRastreio?: string; tone?: Tone; variant?: 1 | 2;
}) {
  const visiveis = servicos.filter((s) => s.disponivel !== false);
  if (visiveis.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const msg = CTA_CONTEXTUAL[familiaId].servicos;
  return <section id="servicos" className="vertice-services"><Reveal><div className="vertice-services__inner">
    <header className="vertice-services__head">
      <span className="v-label">O que oferecemos</span>
      <h2>{gerarTituloServicos(empresa)}</h2>
      <p>Serviços reais cadastrados por {empresa.nome || "esta empresa"}, apresentados como índice para você comparar de uma vez.</p>
    </header>
    <ol className="vertice-services__list">
      {visiveis.map((servico, i) => {
        const temPreco = typeof servico.preco_centavos === "number" && servico.preco_centavos > 0;
        const mensagem = temPreco ? `${msg} (${servico.nome} — ${formatarPreco(servico.preco_centavos!)})` : `${msg} (${servico.nome})`;
        const link = waBase ? `${waBase}${encodeURIComponent(mensagem)}` : "";
        const href = link && codigoRastreio ? construirLinkComRastreio(link, codigoRastreio) : link;
        return <li className="vertice-service" key={servico.id}>
          <span className="vertice-service__no">{String(i + 1).padStart(2, "0")}</span>
          <div className="vertice-service__body">
            <h3>{servico.nome}</h3>
            {servico.descricao && <p>{servico.descricao}</p>}
            <div className="vertice-service__foot">
              {temPreco && <strong>{formatarPreco(servico.preco_centavos!)}</strong>}
              {href && <a href={href} target="_blank" rel="noreferrer">{temPreco ? "Pedir este item" : "Perguntar sobre este serviço"}<span aria-hidden="true">→</span></a>}
            </div>
          </div>
          {/* alt vazio é proposital: a prancha acompanha o nome logo ao lado,
              então descrevê-la de novo faria o leitor de tela repetir o item. */}
          {servico.imagem_url && <img className="vertice-service__thumb" src={servico.imagem_url} alt="" loading="lazy" decoding="async"/>}
        </li>;
      })}
    </ol>
  </div></Reveal><style>{`
    .vertice-services{background:${p.bg};padding:112px 24px}
    .vertice-services__inner{max-width:1240px;margin:0 auto}
    .vertice-services .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-services__head{max-width:760px;margin-bottom:48px}
    .vertice-services h2{margin:22px 0 18px;font-family:${font.display};font-weight:600;font-size:clamp(28px,3.4vw,42px);line-height:1.14;color:${p.text};text-wrap:balance}
    .vertice-services__head>p{margin:0;font-family:${font.body};font-size:15.5px;line-height:1.8;color:${p.textMuted};overflow-wrap:anywhere}
    .vertice-services__list{margin:0;padding:0;list-style:none;border-top:1px solid ${p.line}}
    .vertice-service{display:grid;grid-template-columns:52px minmax(0,1fr) 172px;gap:28px;align-items:start;padding:30px 0;border-bottom:1px solid ${p.line}}
    .vertice-service__no{font-family:${font.display};font-size:14px;font-weight:600;color:${p.accent};padding-top:5px}
    .vertice-service__body{min-width:0}
    .vertice-service h3{margin:0 0 9px;font-family:${font.body};font-size:19px;font-weight:700;line-height:1.35;color:${p.text};overflow-wrap:anywhere}
    .vertice-service__body>p{margin:0 0 14px;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};max-width:620px;overflow-wrap:anywhere}
    .vertice-service__foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px}
    .vertice-service__foot strong{font-family:${font.body};font-size:14.5px;font-weight:800;color:${p.text}}
    .vertice-service__foot a{display:inline-flex;align-items:center;gap:8px;color:${p.accent};text-decoration:none;font-family:${font.body};font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid ${p.accent};padding-bottom:2px;transition:gap .18s}
    .vertice-service__foot a:hover{gap:13px}
    .vertice-service__thumb{width:100%;aspect-ratio:3/2;object-fit:cover;border:1px solid ${p.line};background:${p.card}}
    @media(max-width:900px){
      .vertice-services{padding:88px 20px}
      .vertice-service{grid-template-columns:38px minmax(0,1fr);gap:16px;padding:24px 0}
      .vertice-service__thumb{grid-column:2;max-width:280px;margin-top:4px}
    }
  `}</style></section>;
}

// ── Galeria + Estrutura + Antes e Depois ──────────────────────────────────
// Pranchas emolduradas em grade de fios, com a legenda FORA da imagem (o
// oposto da pílula sobre a foto do Aurora) e a primeira prancha maior quando
// há acervo suficiente. TODAS as fotos enviadas aparecem — nenhum recorte
// silencioso por posição. Antes/Depois só existe com os dois lados do par.
export function GaleriaVertice({ galeria, estrutura, antesDepois = [], empresa, tema, tone = "light", variant = 2 }: {
  antesDepois?: DBAntes[]; galeria: DBGaleria[]; estrutura: DBEstrutura[]; empresa: Empresa; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const fotos = [...galeria.map(g => ({ id: g.id, url: g.url, titulo: g.titulo || g.categoria })), ...estrutura.map(e => ({ id: e.id, url: e.imagem_url, titulo: e.titulo }))].filter(f => f.url);
  const comparacoes = antesDepois.filter(a => a.antes_url && a.depois_url);
  if (!fotos.length && !comparacoes.length) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="galeria" className="vertice-gallery"><Reveal><div className="vertice-gallery__inner">
    <header className="vertice-gallery__head">
      <span className="v-label">Em imagens</span>
      <h2>{gerarTituloGaleria(empresa)}</h2>
      <p>Registros reais do trabalho, do ambiente e dos detalhes de {empresa.nome || "a empresa"}.</p>
    </header>
    {fotos.length > 0 && <ul className={`vertice-plates ${fotos.length === 1 ? "is-single" : ""}`}>
      {fotos.map((foto, i) => <li className={`vertice-plate ${i === 0 && fotos.length > 2 ? "is-lead" : ""}`} key={foto.id}>
        <img src={foto.url} alt={foto.titulo} loading="lazy" decoding="async"/>
        <span className="vertice-plate__caption">{foto.titulo}</span>
      </li>)}
    </ul>}
    {comparacoes.length > 0 && <div className="vertice-cases">
      {comparacoes.map(caso => <article className="vertice-case" key={caso.id}>
        <header><h3>{caso.titulo}</h3>{caso.descricao && <p>{caso.descricao}</p>}</header>
        <div className="vertice-case__pair">
          <figure><figcaption>Antes</figcaption><img src={caso.antes_url!} alt={`Antes: ${caso.titulo}`} loading="lazy" decoding="async"/></figure>
          <figure><figcaption>Depois</figcaption><img src={caso.depois_url!} alt={`Depois: ${caso.titulo}`} loading="lazy" decoding="async"/></figure>
        </div>
      </article>)}
    </div>}
  </div></Reveal><style>{`
    .vertice-gallery{background:${p.bg};padding:112px 24px}
    .vertice-gallery__inner{max-width:1240px;margin:0 auto}
    .vertice-gallery .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-gallery__head{max-width:720px;margin-bottom:44px}
    .vertice-gallery h2{margin:22px 0 18px;font-family:${font.display};font-weight:600;font-size:clamp(28px,3.4vw,42px);line-height:1.14;color:${p.text};text-wrap:balance}
    .vertice-gallery__head>p{margin:0;font-family:${font.body};font-size:15.5px;line-height:1.8;color:${p.textMuted};overflow-wrap:anywhere}
    .vertice-plates{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
    .vertice-plates.is-single{grid-template-columns:minmax(0,640px)}
    .vertice-plate{min-width:0;border:1px solid ${p.line};background:${p.card};padding:10px}
    .vertice-plate img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
    .vertice-plate.is-lead{grid-column:span 2}
    .vertice-plate.is-lead img{aspect-ratio:16/9}
    .vertice-plate__caption{display:block;padding:12px 2px 2px;font-family:${font.body};font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${p.textMuted};overflow-wrap:anywhere}
    .vertice-cases{margin-top:34px;display:grid;gap:26px}
    .vertice-case{border-top:1px solid ${p.line};padding-top:26px}
    .vertice-case h3{margin:0 0 8px;font-family:${font.display};font-size:20px;font-weight:600;color:${p.text};overflow-wrap:anywhere}
    .vertice-case header p{margin:0 0 18px;font-family:${font.body};font-size:14px;line-height:1.7;color:${p.textMuted};max-width:640px;overflow-wrap:anywhere}
    .vertice-case__pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
    .vertice-case__pair figure{margin:0;min-width:0}
    .vertice-case__pair figcaption{padding-bottom:10px;font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${p.accent}}
    .vertice-case__pair img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:${p.card};border:1px solid ${p.line}}
    @media(max-width:900px){
      .vertice-gallery{padding:88px 20px}
      .vertice-plates{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .vertice-plate.is-lead{grid-column:span 2}
      .vertice-plate.is-lead img{aspect-ratio:16/10}
    }
    @media(max-width:560px){
      .vertice-plates,.vertice-plates.is-single{grid-template-columns:minmax(0,1fr)}
      .vertice-plate.is-lead{grid-column:auto}
      .vertice-plate.is-lead img{aspect-ratio:4/3}
      .vertice-case__pair{grid-template-columns:minmax(0,1fr);gap:16px}
    }
  `}</style></section>;
}

// ── Equipe ────────────────────────────────────────────────────────────────
// Ficha de equipe, não grade de cartões centrados: retrato quadrado à
// esquerda, nome em serif e função em caixa alta à direita, separados por
// fio. Sem foto cadastrada, o lugar recebe a inicial do nome (nunca silhueta
// genérica nem nome inventado).
export function EquipeVertice({ equipe, tema, tone = "dark", variant = 1 }: {
  equipe: DBEquipe[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  if (equipe.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="equipe" className="vertice-team"><Reveal><div className="vertice-team__inner">
    <header className="vertice-team__head">
      <span className="v-label">Equipe</span>
      <h2>Quem cuida do seu atendimento</h2>
    </header>
    <ul className="vertice-team__list">
      {equipe.map(membro => <li className="vertice-member" key={membro.id}>
        {membro.foto_url
          ? <img src={membro.foto_url} alt={membro.nome} loading="lazy" decoding="async"/>
          : <span className="vertice-member__mark" aria-hidden="true">{initials(membro.nome)}</span>}
        <div className="vertice-member__body">
          <h3>{membro.nome}</h3>
          {membro.especialidade && <span className="vertice-member__role">{membro.especialidade}</span>}
          {membro.descricao && <p>{membro.descricao}</p>}
        </div>
      </li>)}
    </ul>
  </div></Reveal><style>{`
    .vertice-team{background:${p.bg};padding:112px 24px}
    .vertice-team__inner{max-width:1240px;margin:0 auto}
    .vertice-team .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-team__head{display:grid;grid-template-columns:minmax(0,.3fr) minmax(0,1fr);gap:56px;align-items:baseline;margin-bottom:46px}
    .vertice-team h2{margin:0;font-family:${font.display};font-weight:600;font-size:clamp(26px,3.1vw,38px);line-height:1.16;color:${p.text};text-wrap:balance}
    .vertice-team__list{margin:0;padding:0;list-style:none;border-top:1px solid ${p.line}}
    .vertice-member{display:grid;grid-template-columns:118px minmax(0,1fr);gap:30px;align-items:start;padding:28px 0;border-bottom:1px solid ${p.line}}
    .vertice-member>img,.vertice-member__mark{width:118px;aspect-ratio:1;object-fit:cover;border:1px solid ${p.line};background:${p.card};display:flex;align-items:center;justify-content:center;font-family:${font.display};font-size:30px;color:${p.accent}}
    .vertice-member__body{min-width:0}
    .vertice-member h3{margin:6px 0 6px;font-family:${font.display};font-size:21px;font-weight:600;color:${p.text};overflow-wrap:anywhere}
    .vertice-member__role{display:block;margin-bottom:12px;font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${p.accent};overflow-wrap:anywhere}
    .vertice-member__body>p{margin:0;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};max-width:620px;overflow-wrap:anywhere}
    @media(max-width:900px){
      .vertice-team{padding:88px 20px}
      .vertice-team__head{grid-template-columns:1fr;gap:16px;margin-bottom:30px}
      .vertice-member{grid-template-columns:82px minmax(0,1fr);gap:18px;padding:22px 0}
      .vertice-member>img,.vertice-member__mark{width:82px;font-size:22px}
      .vertice-member h3{font-size:18px;margin-top:0}
    }
  `}</style></section>;
}

// ── Depoimentos ───────────────────────────────────────────────────────────
// Citação editorial em coluna única: frase grande em serif entre fios, com a
// atribuição (nome, cidade e a nota REAL cadastrada) na linha de base. Sem
// cartão e sem carrossel — o depoimento é lido como um testemunho, não como
// um card de rede social.
export function DepoimentosVertice({ depoimentos, tema, tone = "light", variant = 1 }: {
  depoimentos: DBDepoimento[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  if (!depoimentos.length) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="depoimentos" className="vertice-testimonials"><Reveal><div className="vertice-testimonials__inner">
    <header className="vertice-testimonials__head">
      <span className="v-label">Depoimentos</span>
      <h2>{gerarTituloDepoimentos()}</h2>
    </header>
    <ul className="vertice-testimonials__list">
      {depoimentos.map(depoimento => <li className="vertice-testimonial" key={depoimento.id}>
        <blockquote>“{depoimento.comentario}”</blockquote>
        <div className="vertice-testimonial__by">
          <strong>{depoimento.nome}</strong>
          {depoimento.cidade && <span className="vertice-testimonial__city">{depoimento.cidade}</span>}
          {depoimento.nota > 0 && <span className="vertice-testimonial__score">
            {[1, 2, 3, 4, 5].map(n => <IcStarFilled key={n} size={12} color={n <= depoimento.nota ? tema.emotional : p.line}/>)}
            <span className="vertice-testimonial__nota">Nota {numeroDaNota(depoimento.nota)}/5</span>
          </span>}
        </div>
      </li>)}
    </ul>
  </div></Reveal><style>{`
    .vertice-testimonials{background:${p.bg};padding:112px 24px}
    .vertice-testimonials__inner{max-width:1000px;margin:0 auto}
    .vertice-testimonials .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-testimonials__head{margin-bottom:44px}
    .vertice-testimonials h2{margin:22px 0 0;font-family:${font.display};font-weight:600;font-size:clamp(26px,3.1vw,38px);line-height:1.16;color:${p.text};max-width:660px;text-wrap:balance}
    .vertice-testimonials__list{margin:0;padding:0;list-style:none;border-top:1px solid ${p.line}}
    .vertice-testimonial{padding:36px 0 30px;border-bottom:1px solid ${p.line}}
    .vertice-testimonial blockquote{margin:0 0 22px;font-family:${font.display};font-weight:600;font-size:clamp(19px,2.2vw,26px);line-height:1.55;color:${p.text};max-width:840px;overflow-wrap:anywhere}
    .vertice-testimonial__by{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;font-family:${font.body}}
    .vertice-testimonial__by strong{font-size:14px;color:${p.text}}
    .vertice-testimonial__city{font-size:12.5px;color:${p.textMuted}}
    .vertice-testimonial__score{display:inline-flex;align-items:center;gap:7px}
    .vertice-testimonial__nota{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${p.textMuted}}
    @media(max-width:900px){.vertice-testimonials{padding:88px 20px}.vertice-testimonial{padding:26px 0 22px}}
  `}</style></section>;
}

// ── Dúvidas frequentes ────────────────────────────────────────────────────
// Lista de definição NATIVA (<details>/<summary>): abre e fecha sem uma linha
// de JavaScript, e por isso este bloco não é um componente de cliente como o
// do modelo Aurora. Só aparece com FAQ real cadastrado; sem dado, a seção
// inteira desaparece — nunca perguntas universais fingindo ser do negócio.
export function FaqVertice({ faqs, tema, tone = "dark", variant = 2 }: {
  faqs: DBFaq[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  if (faqs.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="faq" className="vertice-faq"><Reveal><div className="vertice-faq__inner">
    <header className="vertice-faq__head">
      <span className="v-label">Dúvidas frequentes</span>
      <h2>Perguntas frequentes</h2>
      <p>As respostas abaixo foram cadastradas pela própria empresa.</p>
    </header>
    <div className="vertice-faq__list">
      {faqs.map(faq => <details className="vertice-faq__item" key={faq.id}>
        <summary><span>{faq.pergunta}</span><span aria-hidden="true"><Icon name="plus" size={18}/></span></summary>
        <p className="vertice-faq__answer">{faq.resposta}</p>
      </details>)}
    </div>
  </div></Reveal><style>{`
    .vertice-faq{background:${p.bg};padding:112px 24px}
    .vertice-faq__inner{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);gap:64px;align-items:start}
    .vertice-faq .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-faq h2{margin:22px 0 16px;font-family:${font.display};font-weight:600;font-size:clamp(26px,3.1vw,38px);line-height:1.16;color:${p.text};text-wrap:balance}
    .vertice-faq__head>p{margin:0;font-family:${font.body};font-size:15px;line-height:1.8;color:${p.textMuted};max-width:330px;overflow-wrap:anywhere}
    .vertice-faq__list{border-top:1px solid ${p.line}}
    .vertice-faq__item{border-bottom:1px solid ${p.line}}
    .vertice-faq__item summary{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;padding:22px 0;cursor:pointer;list-style:none;font-family:${font.display};font-size:18.5px;font-weight:600;line-height:1.45;color:${p.text}}
    .vertice-faq__item summary::-webkit-details-marker{display:none}
    .vertice-faq__item summary>span:first-child{overflow-wrap:anywhere}
    .vertice-faq__item summary>span:last-child{flex-shrink:0;display:flex;color:${p.accent};transition:transform .25s}
    .vertice-faq__item[open] summary>span:last-child{transform:rotate(45deg)}
    .vertice-faq__answer{margin:0 0 26px;font-family:${font.body};font-size:15px;line-height:1.8;color:${p.textMuted};max-width:620px;overflow-wrap:anywhere}
    @media(max-width:980px){.vertice-faq{padding:88px 20px}.vertice-faq__inner{grid-template-columns:1fr;gap:26px}.vertice-faq__head>p{max-width:none}}
  `}</style></section>;
}

// ── Contato ───────────────────────────────────────────────────────────────
// Ficha técnica tipográfica (rótulo em caixa alta + valor), sem ícone e sem
// caixa com gradiente: o contato é apresentado como dado de registro. Cada
// linha só existe se o dado existir no cadastro; o mapa só aparece com
// endereço e link cadastrados.
export function ContatoVertice({ empresa, waLink, whatsappNumber, tema, tone = "light", variant = 2 }: {
  empresa: Empresa; waLink: string; whatsappNumber?: string; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const linhas = [
    empresa.endereco ? ["Endereço", empresa.endereco + (local ? ` — ${local}` : ""), null] : null,
    empresa.telefone ? ["Telefone", empresa.telefone, "tel:" + empresa.telefone] : null,
    empresa.email ? ["E-mail", empresa.email, "mailto:" + empresa.email] : null,
    empresa.horario_funcionamento ? ["Atendimento", empresa.horario_funcionamento, null] : null,
    empresa.nota_google ? ["Avaliação Google", `${numeroDaNota(empresa.nota_google)}${empresa.num_avaliacoes ? ` · ${empresa.num_avaliacoes} avaliações` : ""}`, null] : null,
  ].filter(Boolean) as [string, string, string | null][];
  if (linhas.length === 0 && !whatsappNumber) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="contato" className="vertice-contact"><Reveal><div className="vertice-contact__inner">
    <div className="vertice-contact__lead">
      <span className="v-label">Contato</span>
      <h2>{gerarTituloContato(local)}</h2>
      <p>Escolha o canal mais conveniente. Todos os dados abaixo são os cadastrados pela empresa.</p>
      {whatsappNumber && <a className="vertice-contact__cta" href={waLink} target="_blank" rel="noreferrer"><IcWa size={16}/>Falar no WhatsApp</a>}
    </div>
    <div>
      {linhas.length > 0 && <dl className="vertice-contact__ficha">
        {linhas.map(([rotulo, valor, href]) => <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{href ? <a href={href}>{valor}</a> : valor}</dd>
        </div>)}
      </dl>}
      {empresa.endereco?.trim() && empresa.google_maps_url && <a className="vertice-contact__map" href={empresa.google_maps_url} target="_blank" rel="noreferrer">Ver localização no mapa →</a>}
    </div>
  </div></Reveal><style>{`
    .vertice-contact{background:${p.bg};padding:112px 24px}
    .vertice-contact__inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:72px;align-items:start}
    .vertice-contact .v-label{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-contact h2{margin:22px 0 20px;font-family:${font.display};font-weight:600;font-size:clamp(30px,3.8vw,46px);line-height:1.12;color:${p.text};text-wrap:balance}
    .vertice-contact__lead>p{margin:0 0 30px;font-family:${font.body};font-size:15.5px;line-height:1.8;color:${p.textMuted};max-width:430px;overflow-wrap:anywhere}
    .vertice-contact__cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;background:${p.accent};color:${tone === "dark" ? tema.ink3 : "#ffffff"};text-decoration:none;font-family:${font.body};font-size:12.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;transition:opacity .2s}
    .vertice-contact__cta:hover{opacity:.88}
    .vertice-contact__ficha{margin:0;border-top:1px solid ${p.line}}
    .vertice-contact__ficha>div{display:grid;grid-template-columns:142px minmax(0,1fr);gap:22px;padding:20px 0;border-bottom:1px solid ${p.line}}
    .vertice-contact__ficha dt{font-family:${font.body};font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${p.textMuted}}
    .vertice-contact__ficha dd{margin:0;font-family:${font.body};font-size:15px;font-weight:600;line-height:1.6;color:${p.text};overflow-wrap:anywhere}
    .vertice-contact__ficha dd a{color:inherit;text-decoration:none;border-bottom:1px solid ${p.line}}
    .vertice-contact__map{display:inline-block;margin-top:24px;padding-bottom:2px;border-bottom:1px solid ${p.accent};color:${p.accent};text-decoration:none;font-family:${font.body};font-size:13px;font-weight:700}
    @media(max-width:980px){.vertice-contact{padding:88px 20px}.vertice-contact__inner{grid-template-columns:1fr;gap:38px}}
    @media(max-width:600px){.vertice-contact__ficha>div{grid-template-columns:minmax(0,1fr);gap:6px}}
  `}</style></section>;
}

// ── Fecho ─────────────────────────────────────────────────────────────────
// Faixa escura dividida: afirmação à esquerda, ações enfileiradas à direita.
// Só existe com WhatsApp ou telefone cadastrado — nunca um botão sem destino.
export function CtaFinalVertice({ empresa, waLink, whatsappNumber, titulo, subtitulo, ctaTexto, tema }: {
  empresa: Empresa; waLink: string; whatsappNumber?: string; titulo: string; subtitulo: string; ctaTexto: string; tema: Tema;
}) {
  if (!whatsappNumber && !empresa.telefone) return null;
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  return <section className="vertice-cta"><Reveal><div className="vertice-cta__inner">
    <div className="vertice-cta__copy">
      <span className="v-label">Vamos conversar</span>
      <h2>{titulo}</h2>
      <p>{subtitulo}</p>
    </div>
    <div className="vertice-cta__actions">
      {whatsappNumber && <a className="vertice-cta__solid" href={waLink} target="_blank" rel="noreferrer"><IcWa size={16}/>{ctaTexto}</a>}
      {empresa.telefone && <a className="vertice-cta__line" href={"tel:" + empresa.telefone}><IcPhone/>{empresa.telefone}</a>}
      <span className="vertice-cta__note">Resposta rápida, sem compromisso.</span>
    </div>
  </div></Reveal><style>{`
    .vertice-cta{background:${tema.ink};padding:112px 24px}
    .vertice-cta__inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:56px;align-items:center}
    .vertice-cta .v-label{display:inline-block;color:${tema.primary};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
    .vertice-cta h2{margin:24px 0 18px;font-family:${font.display};font-weight:600;font-size:clamp(32px,4.4vw,54px);line-height:1.08;color:${tema.text};max-width:720px;text-wrap:balance}
    .vertice-cta__copy>p{margin:0;font-family:${font.body};font-size:16px;line-height:1.75;color:${tema.textMuted};max-width:520px;overflow-wrap:anywhere}
    .vertice-cta__actions{display:grid;gap:12px;justify-items:stretch;min-width:290px}
    .vertice-cta__solid,.vertice-cta__line{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 26px;text-decoration:none;font-family:${font.body};font-size:12.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;overflow-wrap:anywhere;transition:background .2s,color .2s,border-color .2s}
    .vertice-cta__solid{background:${tema.primary};color:${tema.ink3}}
    .vertice-cta__solid:hover{background:${tema.text};color:${tema.ink3}}
    .vertice-cta__line{border:1px solid ${tema.line};color:${tema.text}}
    .vertice-cta__line:hover{border-color:${tema.primary};color:${tema.primary}}
    .vertice-cta__note{font-family:${font.body};font-size:12px;color:${tema.textFaint};text-align:center;overflow-wrap:anywhere}
    @media(max-width:900px){.vertice-cta{padding:86px 20px}.vertice-cta__inner{grid-template-columns:1fr;gap:34px}.vertice-cta__actions{min-width:0}}
  `}</style></section>;
}

// ── Rodapé ────────────────────────────────────────────────────────────────
// Rodapé institucional em fio: assinatura em serif, navegação em caixa alta,
// contato como texto e redes como links nomeados (nunca ícones soltos).
// Endereço, horário e redes só aparecem quando existem no cadastro.
export function FooterVertice({ empresa, nome, esp, navItems, tema }: {
  empresa: Empresa; nome: string; esp: string; navItems: SiteNavItem[]; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const redes = [
    empresa.instagram_url ? { href: empresa.instagram_url, label: "Instagram" } : null,
    empresa.facebook_url ? { href: empresa.facebook_url, label: "Facebook" } : null,
    empresa.linkedin_url ? { href: empresa.linkedin_url, label: "LinkedIn" } : null,
    empresa.tiktok_url ? { href: empresa.tiktok_url, label: "TikTok" } : null,
  ].filter(Boolean) as { href: string; label: string }[];
  return <footer className="vertice-footer"><div className="vertice-footer__inner">
    <div className="vertice-footer__brand">
      <strong>{nome}</strong>
      {esp && <span>{esp}</span>}
      {local && <span>{local}</span>}
    </div>
    <div className="vertice-footer__cols">
      {navItems.length > 0 && <nav aria-label="Seções do site">{navItems.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>}
      <div className="vertice-footer__contact">
        {empresa.telefone && <a href={"tel:" + empresa.telefone}>{empresa.telefone}</a>}
        {empresa.email && <a href={"mailto:" + empresa.email}>{empresa.email}</a>}
        {empresa.endereco && <span>{empresa.endereco}</span>}
        {empresa.horario_funcionamento && <span>{empresa.horario_funcionamento}</span>}
      </div>
      {redes.length > 0 && <div className="vertice-footer__redes">
        {redes.map(rede => <a key={rede.label} href={rede.href} target="_blank" rel="noreferrer">{rede.label}</a>)}
      </div>}
    </div>
    <div className="vertice-footer__base">
      <span>© {new Date().getFullYear()} {nome}. Todos os direitos reservados.</span>
      <span className="op-sig">Site feito com <b>OrganizaPro</b></span>
    </div>
  </div><style>{`
    .vertice-footer{background:${tema.ink3};padding:58px 24px 24px;border-top:1px solid ${tema.line};font-family:${font.body}}
    .vertice-footer__inner{max-width:1240px;margin:0 auto}
    .vertice-footer__brand strong{display:block;font-family:${font.display};font-size:24px;font-weight:600;color:${tema.text};overflow-wrap:anywhere}
    .vertice-footer__brand span{display:block;margin-top:8px;font-size:12px;color:${tema.textFaint};overflow-wrap:anywhere}
    .vertice-footer__cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:30px;margin:40px 0 34px;padding:30px 0;border-top:1px solid ${tema.line};border-bottom:1px solid ${tema.line}}
    .vertice-footer nav,.vertice-footer__contact,.vertice-footer__redes{display:flex;flex-direction:column;gap:11px;min-width:0}
    .vertice-footer nav a{font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${tema.textMuted};text-decoration:none;overflow-wrap:anywhere}
    .vertice-footer nav a:hover{color:${tema.text}}
    .vertice-footer__contact a,.vertice-footer__contact span,.vertice-footer__redes a{font-size:13px;color:${tema.textMuted};text-decoration:none;overflow-wrap:anywhere}
    .vertice-footer__contact a:hover,.vertice-footer__redes a:hover{color:${tema.text}}
    .vertice-footer__base{display:flex;justify-content:space-between;gap:16px;font-size:11px;color:${tema.textFaint}}
    .vertice-footer__base .op-sig b{color:${tema.primary};font-weight:700}
    @media(max-width:700px){.vertice-footer{padding:44px 20px 20px}.vertice-footer__cols{grid-template-columns:1fr;gap:24px;margin:30px 0 26px;padding:24px 0}.vertice-footer__base{flex-direction:column;gap:8px}}
  `}</style></footer>;
}
