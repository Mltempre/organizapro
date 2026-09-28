import type { ReactNode } from "react";
import Reveal, { RevealItem } from "../../_components/Reveal";
import {
  Icon, IcWa, IcPhone, IcMail, IcPin, IcClock, IcStarFilled,
  IcInstagram, IcFacebook, IcLinkedin, IcTiktok,
} from "../../_components/icons";
import {
  gerarTituloSobre, gerarTituloServicos, gerarTituloGaleria,
  gerarTituloDepoimentos, gerarTituloContato, initials,
} from "../../_lib/helpers";
import { CTA_CONTEXTUAL, DIFERENCIAIS, PROBLEMA, PROCESSO } from "../../_lib/content";
import { paleta, type FamiliaId, type Tema, type Tone } from "../../_lib/families";
import type {
  DBGaleria, DBEstrutura, DBAntes, DBServico, DBDepoimento, DBEquipe, DBFaq, Empresa,
} from "../../_lib/types";
import type { SiteNavItem } from "../../_components/Header";
import { construirLinkComRastreio } from "../../../../../lib/atribuicao-origem";

// ── Seções PULSE ──────────────────────────────────────────────────────────
// Comercial e visual: faixas de cor da marca, títulos pesados em Archivo,
// blocos assimétricos, foto grande em toda a largura, prova social em cartões
// compactos e chamada de ação sempre à vista. Cada bloco só existe com o dado
// real correspondente — nada de texto, preço, nome ou número inventado.
//
// As cores de acento são sempre escopadas na própria section
// (`.pulse-x .pulse-kicker{...}`) porque as seções alternam entre claro e
// escuro: uma classe compartilhada de cor pintaria a seção errada.

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numeroDaNota(nota: number): string {
  return String(nota).replace(".", ",");
}

// O ícone do serviço é dado livre do cadastro (o negócio demo usa emoji, por
// exemplo). O vocabulário neutro de `Icon` cobre só alguns nomes e devolve
// `null` para o resto — o que, num selo VISÍVEL, deixaria um quadrado vazio.
// Aqui o glifo é resolvido antes: nome conhecido vira ícone; qualquer outro
// valor cai no número do item, que existe sempre. Nada de selo em branco.
function glifoDoServico(icone: string | null | undefined, cor: string) {
  if (!icone) return null;
  return Icon({ name: icone, size: 22, color: cor }) ?? null;
}

// ── Serviços ──────────────────────────────────────────────────────────────
// Primeira seção depois do hero (oferta antes de tudo): cartões grandes na
// faixa escura do modelo, preço em destaque e botão de acento em cada item. A
// primeira peça vira destaque largo quando existe imagem cadastrada; item
// pausado (disponivel === false) desaparece.
export function ServicosPulse({ servicos, empresa, tema, familiaId, waBase, codigoRastreio, tone = "dark", variant = 2 }: {
  servicos: DBServico[]; empresa: Empresa; tema: Tema; familiaId: FamiliaId; waBase?: string; codigoRastreio?: string; tone?: Tone; variant?: 1 | 2;
}) {
  const visiveis = servicos.filter((s) => s.disponivel !== false);
  if (visiveis.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const msg = CTA_CONTEXTUAL[familiaId].servicos;
  const temDestaque = visiveis.length > 2 && Boolean(visiveis[0].imagem_url);
  return <section id="servicos" className="pulse-services"><Reveal><div className="pulse-services__inner">
    <header className="pulse-services__head">
      <div className="pulse-services__title">
        <span className="pulse-kicker">O que oferecemos</span>
        <h2>{gerarTituloServicos(empresa)}</h2>
      </div>
      <p>Escolha o que você precisa e fale direto com {empresa.nome || "a empresa"} — sem intermediário.</p>
    </header>
    <div className={`pulse-services__grid ${temDestaque ? "has-feature" : ""}`}>
      {visiveis.map((servico, i) => {
        const temPreco = typeof servico.preco_centavos === "number" && servico.preco_centavos > 0;
        const mensagem = temPreco ? `${msg} (${servico.nome} — ${formatarPreco(servico.preco_centavos!)})` : `${msg} (${servico.nome})`;
        const link = waBase ? `${waBase}${encodeURIComponent(mensagem)}` : "";
        const href = link && codigoRastreio ? construirLinkComRastreio(link, codigoRastreio) : link;
        return <RevealItem key={servico.id} index={i}>
          <article className={`pulse-service ${servico.imagem_url ? "has-image" : ""} ${temDestaque && i === 0 ? "is-feature" : ""}`}>
            {servico.imagem_url
              ? <img src={servico.imagem_url} alt={servico.nome} loading="lazy" decoding="async"/>
              : <span className="pulse-service__icon" aria-hidden="true">{glifoDoServico(servico.icone, p.accent) ?? <b>{String(i + 1).padStart(2, "0")}</b>}</span>}
            <div className="pulse-service__body">
              <h3>{servico.nome}</h3>
              {servico.descricao && <p>{servico.descricao}</p>}
              <div className="pulse-service__foot">
                {temPreco && <strong>{formatarPreco(servico.preco_centavos!)}</strong>}
                {href && <a href={href} target="_blank" rel="noreferrer">{temPreco ? "Pedir agora" : "Quero saber mais"}<span aria-hidden="true">→</span></a>}
              </div>
            </div>
          </article>
        </RevealItem>;
      })}
    </div>
  </div></Reveal><style>{`
    .pulse-services{background:${p.bg};padding:112px 24px}
    .pulse-services__inner{max-width:1240px;margin:0 auto}
    .pulse-services .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-services__head{display:flex;align-items:flex-end;justify-content:space-between;gap:46px;margin-bottom:44px}
    .pulse-services h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(30px,4vw,48px);line-height:1.05;letter-spacing:-.02em;color:${p.text};max-width:620px;text-wrap:balance}
    .pulse-services__head>p{max-width:340px;margin:0;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-services__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(272px,1fr));gap:18px}
    .pulse-services__grid.has-feature{grid-template-columns:repeat(3,minmax(0,1fr))}
    .pulse-service{position:relative;display:flex;flex-direction:column;height:100%;min-height:248px;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card};overflow:hidden;transition:transform .22s,border-color .22s}
    .pulse-service:hover{transform:translateY(-4px);border-color:${tema.primaryBorder}}
    .pulse-service.is-feature{grid-column:span 2}
    .pulse-service.has-image{min-height:338px}
    .pulse-service>img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}
    .pulse-service__icon{width:52px;height:52px;border-radius:16px;background:${tema.primarySoft};display:flex;align-items:center;justify-content:center;margin:26px 26px 0}
    .pulse-service__icon b{font-family:${font.display};font-size:15px;font-weight:800;color:${p.accent}}
    .pulse-service__body{display:flex;flex-direction:column;gap:10px;flex:1;padding:22px 26px 26px;min-width:0}
    .pulse-service__icon+.pulse-service__body{padding-top:18px}
    .pulse-service h3{margin:0;font-family:${font.display};font-weight:800;font-size:21px;line-height:1.22;letter-spacing:-.01em;color:${p.text};overflow-wrap:anywhere}
    .pulse-service__body>p{margin:0;font-family:${font.body};font-size:14px;line-height:1.7;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-service__foot{margin-top:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;padding-top:16px}
    .pulse-service__foot strong{font-family:${font.display};font-size:20px;font-weight:800;color:${p.text};white-space:nowrap}
    .pulse-service__foot a{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:999px;background:${p.accent};color:${tone === "dark" ? tema.ink3 : "#ffffff"};text-decoration:none;font-family:${font.body};font-size:12.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;transition:transform .16s}
    .pulse-service__foot a:hover{transform:translateY(-1px)}
    @media(max-width:1080px){.pulse-services__grid.has-feature{grid-template-columns:repeat(2,minmax(0,1fr))}.pulse-service.is-feature{grid-column:span 2}}
    @media(max-width:760px){
      .pulse-services{padding:88px 20px}
      .pulse-services__head{flex-direction:column;align-items:flex-start;gap:16px}
      .pulse-services__grid,.pulse-services__grid.has-feature{grid-template-columns:1fr}
      .pulse-service.is-feature{grid-column:auto}
    }
  `}</style></section>;
}

// ── Problema ──────────────────────────────────────────────────────────────
// Faixa clara com a afirmação gigante centralizada e botão sólido — o oposto
// da coluna editorial do Vértice e da caixa à esquerda do Aurora.
export function ProblemaPulse({ familiaId, tema, ctaHref, ctaTexto, tone = "light", variant = 1 }: {
  familiaId: FamiliaId; tema: Tema; ctaHref: string; ctaTexto: string; tone?: Tone; variant?: 1 | 2;
}) {
  const conteudo = PROBLEMA[familiaId];
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section className="pulse-problem"><Reveal><div className="pulse-problem__inner">
    <span className="pulse-kicker">O que você precisa saber</span>
    <h2>{conteudo.titulo}</h2>
    <p>{conteudo.corpo}</p>
    {ctaHref && <a className="pulse-problem__cta" href={ctaHref} target="_blank" rel="noreferrer">{ctaTexto}<span aria-hidden="true">→</span></a>}
  </div></Reveal><style>{`
    .pulse-problem{background:${p.bg};padding:112px 24px;text-align:center}
    .pulse-problem__inner{max-width:900px;margin:0 auto}
    .pulse-problem .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-problem h2{margin:22px 0 22px;font-family:${font.display};font-weight:800;font-size:clamp(28px,4.2vw,52px);line-height:1.07;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-problem p{margin:0 auto 32px;max-width:640px;font-family:${font.body};font-size:16.5px;line-height:1.8;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-problem__cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 28px;border-radius:999px;background:${p.accent};color:${tone === "dark" ? tema.ink3 : "#ffffff"};text-decoration:none;font-family:${font.body};font-size:14px;font-weight:800;letter-spacing:.04em;transition:transform .16s}
    .pulse-problem__cta:hover{transform:translateY(-2px)}
    @media(max-width:760px){.pulse-problem{padding:86px 20px}.pulse-problem__cta{width:100%;justify-content:center}}
  `}</style></section>;
}

// ── Sobre ─────────────────────────────────────────────────────────────────
// Prancha com a marca cadastrada (ou o monograma, quando não há logo) ao lado
// do texto real e dos fatos do cadastro em CHIPS — a leitura comercial do
// "quem somos", sem repetir a foto que já abre o hero.
export function SobrePulse({ empresa, nome, sobre, tema, tone = "dark", variant = 1 }: {
  empresa: Empresa; nome: string; sobre: string[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const fatos: [string, string][] = [
    empresa.especialidade ? ["Atuação", empresa.especialidade] : null,
    local ? ["Onde atende", local] : null,
    empresa.horario_funcionamento ? ["Horário", empresa.horario_funcionamento] : null,
    empresa.nota_google ? ["Google", `${numeroDaNota(empresa.nota_google)}${empresa.num_avaliacoes ? ` · ${empresa.num_avaliacoes} avaliações` : ""}`] : null,
    empresa.endereco ? ["Endereço", empresa.endereco] : null,
  ].filter(Boolean) as [string, string][];
  return <section id="sobre" className="pulse-about"><Reveal><div className="pulse-about__inner">
    <div className="pulse-about__media">
      {empresa.logo_url
        ? <img src={empresa.logo_url} alt={nome} loading="lazy" decoding="async"/>
        : <span className="pulse-about__mark" aria-hidden="true">{initials(nome)}</span>}
    </div>
    <div className="pulse-about__body">
      <span className="pulse-kicker">Sobre</span>
      <h2>{gerarTituloSobre(empresa)}</h2>
      <div className="pulse-about__text">{sobre.map((texto, i) => <p key={i}>{texto}</p>)}</div>
      {fatos.length > 0 && <ul className="pulse-about__chips">
        {fatos.map(([rotulo, valor]) => <li key={rotulo}><span>{rotulo}</span><strong>{valor}</strong></li>)}
      </ul>}
    </div>
  </div></Reveal><style>{`
    .pulse-about{background:${p.bg};padding:112px 24px}
    .pulse-about__inner{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:60px;align-items:center}
    .pulse-about__media{display:flex;align-items:center;justify-content:center;padding:22px;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card};aspect-ratio:4/3.4;min-width:0}
    .pulse-about__media img{width:100%;height:100%;object-fit:contain}
    .pulse-about__mark{font-family:${font.display};font-size:clamp(64px,11vw,116px);font-weight:800;letter-spacing:-.04em;line-height:1;color:${p.accent};opacity:.85;overflow-wrap:anywhere;text-align:center}
    .pulse-about .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-about h2{margin:20px 0 24px;font-family:${font.display};font-weight:800;font-size:clamp(27px,3.5vw,42px);line-height:1.07;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-about__text p{margin:0 0 16px;font-family:${font.body};font-size:15.5px;line-height:1.8;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-about__text p:first-child{color:${p.text};font-size:17.5px;line-height:1.65;font-weight:600}
    .pulse-about__chips{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 0;padding:0;list-style:none}
    .pulse-about__chips li{display:grid;gap:3px;min-width:0;padding:12px 18px;border-radius:14px;border:1px solid ${p.line};background:${p.card}}
    .pulse-about__chips span{font-family:${font.body};font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${p.textMuted}}
    .pulse-about__chips strong{font-family:${font.body};font-size:14px;font-weight:700;line-height:1.5;color:${p.text};overflow-wrap:anywhere}
    @media(max-width:980px){.pulse-about{padding:88px 20px}.pulse-about__inner{grid-template-columns:1fr;gap:32px}.pulse-about__media{aspect-ratio:16/10;max-width:420px}}
  `}</style></section>;
}

// ── Princípios ────────────────────────────────────────────────────────────
// Bento de blocos: o primeiro ocupa duas colunas com uma lavagem da cor da
// marca. Diferente da lista fixa do Aurora e do índice com fios do Vértice.
export function DiferenciaisPulse({ familiaId, tema, tone = "light", variant = 2 }: {
  familiaId: FamiliaId; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const itens = DIFERENCIAIS[familiaId];
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section className="pulse-pillars"><Reveal><div className="pulse-pillars__inner">
    <header className="pulse-pillars__head">
      <span className="pulse-kicker">Por que escolher</span>
      <h2>Uma experiência simples, clara e bem cuidada.</h2>
    </header>
    <div className="pulse-pillars__grid">
      {itens.map((item, i) => <RevealItem key={item.titulo} index={i}>
        <article className={`pulse-pillar ${i === 0 ? "is-lead" : ""}`}>
          <span className="pulse-pillar__no">{String(i + 1).padStart(2, "0")}</span>
          <h3>{item.titulo}</h3>
          <p>{item.desc}</p>
        </article>
      </RevealItem>)}
    </div>
  </div></Reveal><style>{`
    .pulse-pillars{background:${p.bg};padding:112px 24px}
    .pulse-pillars__inner{max-width:1240px;margin:0 auto}
    .pulse-pillars .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-pillars__head{max-width:640px;margin-bottom:42px}
    .pulse-pillars h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(28px,3.7vw,44px);line-height:1.06;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-pillars__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .pulse-pillar{display:flex;flex-direction:column;gap:12px;height:100%;padding:30px;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card}}
    .pulse-pillar.is-lead{grid-column:span 2;background:linear-gradient(140deg,${tema.primarySoft},transparent 62%),${p.card}}
    .pulse-pillar__no{font-family:${font.display};font-size:13px;font-weight:800;letter-spacing:.1em;color:${p.accent}}
    .pulse-pillar h3{margin:0;font-family:${font.display};font-weight:800;font-size:19.5px;line-height:1.25;letter-spacing:-.01em;color:${p.text};overflow-wrap:anywhere}
    .pulse-pillar p{margin:0;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};overflow-wrap:anywhere}
    @media(max-width:980px){.pulse-pillars__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pulse-pillar.is-lead{grid-column:span 2}}
    @media(max-width:680px){.pulse-pillars{padding:88px 20px}.pulse-pillars__grid{grid-template-columns:1fr}.pulse-pillar.is-lead{grid-column:auto}.pulse-pillar{padding:24px}}
  `}</style></section>;
}

// ── Galeria + Estrutura + Antes e Depois ──────────────────────────────────
// Mosaico denso: a primeira foto vira peça larga quando há acervo, as demais
// preenchem a malha e cada legenda fica sobre um gradiente na base da imagem.
// TODAS as fotos enviadas aparecem — nenhum corte silencioso por posição.
export function GaleriaPulse({ galeria, estrutura, antesDepois = [], empresa, tema, tone = "dark", variant = 2 }: {
  antesDepois?: DBAntes[]; galeria: DBGaleria[]; estrutura: DBEstrutura[]; empresa: Empresa; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const fotos = [...galeria.map(g => ({ id: g.id, url: g.url, titulo: g.titulo || g.categoria })), ...estrutura.map(e => ({ id: e.id, url: e.imagem_url, titulo: e.titulo }))].filter(f => f.url);
  const comparacoes = antesDepois.filter(a => a.antes_url && a.depois_url);
  if (!fotos.length && !comparacoes.length) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  const comDestaque = fotos.length > 3;
  return <section id="galeria" className="pulse-gallery"><Reveal><div className="pulse-gallery__inner">
    <header className="pulse-gallery__head">
      <div>
        <span className="pulse-kicker">Em imagens</span>
        <h2>{gerarTituloGaleria(empresa)}</h2>
      </div>
      <p>Registros reais do trabalho, do ambiente e dos detalhes de {empresa.nome || "a empresa"}.</p>
    </header>
    {fotos.length > 0 && <div className={`pulse-gallery__grid ${fotos.length === 1 ? "is-single" : ""}`}>
      {fotos.map((foto, i) => <figure className={`pulse-shot ${comDestaque && i === 0 ? "is-lead" : ""}`} key={foto.id}>
        <img src={foto.url} alt={foto.titulo} loading="lazy" decoding="async"/>
        <figcaption>{foto.titulo}</figcaption>
      </figure>)}
    </div>}
    {comparacoes.length > 0 && <div className="pulse-cases">
      {comparacoes.map(caso => <article className="pulse-case" key={caso.id}>
        <header><h3>{caso.titulo}</h3>{caso.descricao && <p>{caso.descricao}</p>}</header>
        <div className="pulse-case__pair">
          <figure><img src={caso.antes_url!} alt={`Antes: ${caso.titulo}`} loading="lazy" decoding="async"/><figcaption>Antes</figcaption></figure>
          <figure><img src={caso.depois_url!} alt={`Depois: ${caso.titulo}`} loading="lazy" decoding="async"/><figcaption>Depois</figcaption></figure>
        </div>
      </article>)}
    </div>}
  </div></Reveal>
  {/* style do mosaico PULSE */}
  <style>{`
    .pulse-gallery{background:${p.bg};padding:112px 24px}
    .pulse-gallery__inner{max-width:1240px;margin:0 auto}
    .pulse-gallery .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-gallery__head{display:flex;align-items:flex-end;justify-content:space-between;gap:44px;margin-bottom:40px}
    .pulse-gallery h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(28px,3.7vw,44px);line-height:1.06;letter-spacing:-.02em;color:${p.text};max-width:600px;text-wrap:balance;overflow-wrap:anywhere}
    .pulse-gallery__head>p{max-width:360px;margin:0;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-gallery__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:208px;gap:14px}
    .pulse-gallery__grid.is-single{grid-template-columns:minmax(0,1fr);grid-auto-rows:minmax(240px,44vh)}
    .pulse-shot{position:relative;margin:0;min-width:0;overflow:hidden;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card}}
    .pulse-shot img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
    .pulse-shot:hover img{transform:scale(1.06)}
    .pulse-shot figcaption{position:absolute;left:0;right:0;bottom:0;padding:36px 16px 14px;background:linear-gradient(transparent,rgba(8,6,5,.9));color:#fff;font-family:${font.body};font-size:12.5px;font-weight:700;overflow-wrap:anywhere}
    .pulse-shot.is-lead{grid-column:span 2;grid-row:span 2}
    .pulse-cases{margin-top:28px;display:grid;gap:22px}
    .pulse-case{padding:24px;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card}}
    .pulse-case h3{margin:0 0 8px;font-family:${font.display};font-weight:800;font-size:20px;letter-spacing:-.01em;color:${p.text};overflow-wrap:anywhere}
    .pulse-case header p{margin:0 0 16px;font-family:${font.body};font-size:14px;line-height:1.7;color:${p.textMuted};max-width:640px;overflow-wrap:anywhere}
    .pulse-case__pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .pulse-case__pair figure{position:relative;margin:0;min-width:0;overflow:hidden;border-radius:14px;border:1px solid ${p.line}}
    .pulse-case__pair img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:${p.bg}}
    .pulse-case__pair figcaption{position:absolute;left:12px;bottom:12px;padding:6px 12px;border-radius:999px;background:${p.accent};color:${tone === "dark" ? tema.ink3 : "#ffffff"};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    @media(max-width:900px){
      .pulse-gallery{padding:88px 20px}
      .pulse-gallery__head{flex-direction:column;align-items:flex-start;gap:16px}
      .pulse-gallery__grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:168px}
      .pulse-shot.is-lead{grid-column:span 2;grid-row:span 2}
    }
    @media(max-width:560px){
      .pulse-gallery__grid,.pulse-gallery__grid.is-single{grid-template-columns:minmax(0,1fr);grid-auto-rows:196px}
      .pulse-shot.is-lead{grid-column:auto;grid-row:auto}
      .pulse-case{padding:18px}
      .pulse-case__pair{grid-template-columns:minmax(0,1fr)}
    }
  `}</style></section>;
}

// ── Depoimentos ───────────────────────────────────────────────────────────
// Cartões compactos em até três colunas, com fio de acento à esquerda, estrelas
// no topo e a nota REAL cadastrada em destaque. Prova social comercial —
// diferente da citação editorial do Vértice e do cartão grande do Aurora.
export function DepoimentosPulse({ depoimentos, tema, tone = "light", variant = 1 }: {
  depoimentos: DBDepoimento[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  if (!depoimentos.length) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="depoimentos" className="pulse-voices"><Reveal><div className="pulse-voices__inner">
    <header className="pulse-voices__head">
      <span className="pulse-kicker">Depoimentos</span>
      <h2>{gerarTituloDepoimentos()}</h2>
    </header>
    <div className="pulse-voices__grid">
      {depoimentos.map((depoimento, i) => <RevealItem key={depoimento.id} index={i}>
        <article className="pulse-voice">
          {depoimento.nota > 0 && <div className="pulse-voice__stars" aria-hidden="true">
            {[1, 2, 3, 4, 5].map(n => <IcStarFilled key={n} size={14} color={n <= depoimento.nota ? tema.emotional : p.line}/>)}
          </div>}
          <blockquote>“{depoimento.comentario}”</blockquote>
          <footer>
            {depoimento.foto_url
              ? <img src={depoimento.foto_url} alt={depoimento.nome} loading="lazy" decoding="async"/>
              : <span aria-hidden="true">{initials(depoimento.nome)}</span>}
            <div><strong>{depoimento.nome}</strong>{depoimento.cidade && <small>{depoimento.cidade}</small>}</div>
            {depoimento.nota > 0 && <em className="pulse-voice__nota">{numeroDaNota(depoimento.nota)}/5</em>}
          </footer>
        </article>
      </RevealItem>)}
    </div>
  </div></Reveal><style>{`
    .pulse-voices{background:${p.bg};padding:112px 24px}
    .pulse-voices__inner{max-width:1240px;margin:0 auto}
    .pulse-voices .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-voices__head{max-width:620px;margin-bottom:42px}
    .pulse-voices h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(28px,3.7vw,44px);line-height:1.06;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-voices__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .pulse-voice{display:flex;flex-direction:column;gap:16px;height:100%;padding:26px;border-radius:${tema.radius}px;border:1px solid ${p.line};border-left:3px solid ${p.accent};background:${p.card}}
    .pulse-voice__stars{display:flex;gap:3px}
    .pulse-voice blockquote{margin:0;flex:1;font-family:${font.body};font-size:15.5px;line-height:1.75;color:${p.text};overflow-wrap:anywhere}
    .pulse-voice footer{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid ${p.line}}
    .pulse-voice footer>img,.pulse-voice footer>span{width:42px;height:42px;flex-shrink:0;border-radius:50%;object-fit:cover;display:flex;align-items:center;justify-content:center;background:${tema.primarySoft};color:${p.accent};font-family:${font.body};font-size:12px;font-weight:800}
    .pulse-voice footer strong{display:block;font-family:${font.body};font-size:14px;color:${p.text};overflow-wrap:anywhere}
    .pulse-voice footer small{display:block;margin-top:3px;font-family:${font.body};font-size:12px;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-voice__nota{margin-left:auto;font-family:${font.display};font-size:15px;font-style:normal;font-weight:800;color:${p.accent}}
    @media(max-width:980px){.pulse-voices__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:680px){.pulse-voices{padding:86px 20px}.pulse-voices__grid{grid-template-columns:1fr}.pulse-voice{padding:22px}}
  `}</style></section>;
}

// ── Equipe ────────────────────────────────────────────────────────────────
// Cartões-retrato: foto grande em 4/5, nome e função logo abaixo. Sem foto
// cadastrada, o lugar recebe o monograma em acento — nunca uma silhueta
// genérica e nunca um nome inventado.
export function EquipePulse({ equipe, tema, tone = "dark", variant = 2 }: {
  equipe: DBEquipe[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  if (equipe.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="equipe" className="pulse-team"><Reveal><div className="pulse-team__inner">
    <header className="pulse-team__head">
      <span className="pulse-kicker">Equipe</span>
      <h2>Quem cuida do seu atendimento</h2>
    </header>
    <div className="pulse-team__grid">
      {equipe.map((membro, i) => <RevealItem key={membro.id} index={i}>
        <article className="pulse-member">
          <div className="pulse-member__photo">
            {membro.foto_url
              ? <img src={membro.foto_url} alt={membro.nome} loading="lazy" decoding="async"/>
              : <span aria-hidden="true">{initials(membro.nome)}</span>}
          </div>
          <div className="pulse-member__body">
            <h3>{membro.nome}</h3>
            {membro.especialidade && <span className="pulse-member__role">{membro.especialidade}</span>}
            {membro.descricao && <p>{membro.descricao}</p>}
          </div>
        </article>
      </RevealItem>)}
    </div>
  </div></Reveal><style>{`
    .pulse-team{background:${p.bg};padding:112px 24px}
    .pulse-team__inner{max-width:1240px;margin:0 auto}
    .pulse-team .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-team__head{max-width:620px;margin-bottom:42px}
    .pulse-team h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(28px,3.7vw,44px);line-height:1.06;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-team__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(212px,1fr));gap:16px}
    .pulse-member{height:100%;overflow:hidden;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card}}
    .pulse-member__photo{display:flex;align-items:center;justify-content:center;aspect-ratio:4/5;overflow:hidden;background:${tema.primarySoft}}
    .pulse-member__photo img{width:100%;height:100%;object-fit:cover}
    .pulse-member__photo span{font-family:${font.display};font-size:44px;font-weight:800;color:${p.accent}}
    .pulse-member__body{display:grid;gap:7px;padding:20px 22px 24px;min-width:0}
    .pulse-member h3{margin:0;font-family:${font.display};font-weight:800;font-size:18.5px;line-height:1.25;color:${p.text};overflow-wrap:anywhere}
    .pulse-member__role{font-family:${font.body};font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${p.accent};overflow-wrap:anywhere}
    .pulse-member__body>p{margin:0;font-family:${font.body};font-size:13.5px;line-height:1.7;color:${p.textMuted};overflow-wrap:anywhere}
    @media(max-width:680px){.pulse-team{padding:88px 20px}.pulse-team__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:440px){.pulse-team__grid{grid-template-columns:minmax(0,1fr);max-width:330px;margin:0 auto}}
  `}</style></section>;
}

// ── Como funciona ─────────────────────────────────────────────────────────
// Blocos com fio de acento no topo e selo quadrado com o número. Entra DEPOIS
// das provas no Pulse (o inverso do institucional) — quem já viu o trabalho
// quer saber como começar.
export function ProcessoPulse({ familiaId, tema, tone = "light", variant = 2 }: {
  familiaId: FamiliaId; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const passos = PROCESSO[familiaId];
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section className="pulse-steps"><Reveal><div className="pulse-steps__inner">
    <header className="pulse-steps__head">
      <span className="pulse-kicker">Como funciona</span>
      <h2>Do primeiro contato ao resultado</h2>
    </header>
    <ol className="pulse-steps__list">
      {passos.map((passo, i) => <li className="pulse-step" key={i}>
        <span className="pulse-step__no" aria-hidden="true">{passo.numero}</span>
        <h3>{passo.titulo}</h3>
        <p>{passo.desc}</p>
      </li>)}
    </ol>
  </div></Reveal><style>{`
    .pulse-steps{background:${p.bg};padding:112px 24px}
    .pulse-steps__inner{max-width:1240px;margin:0 auto}
    .pulse-steps .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-steps__head{max-width:620px;margin-bottom:40px}
    .pulse-steps h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(28px,3.7vw,44px);line-height:1.06;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-steps__list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin:0;padding:0;list-style:none}
    .pulse-step{padding:26px;border-radius:${tema.radius}px;border:1px solid ${p.line};border-top:4px solid ${p.accent};background:${p.card}}
    .pulse-step__no{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;margin-bottom:16px;border-radius:13px;background:${p.accent};color:${tone === "dark" ? tema.ink3 : "#ffffff"};font-family:${font.display};font-size:14px;font-weight:800}
    .pulse-step h3{margin:0 0 9px;font-family:${font.display};font-weight:800;font-size:18.5px;line-height:1.28;color:${p.text};overflow-wrap:anywhere}
    .pulse-step p{margin:0;font-family:${font.body};font-size:14px;line-height:1.75;color:${p.textMuted};overflow-wrap:anywhere}
    @media(max-width:680px){.pulse-steps{padding:88px 20px}.pulse-step{padding:22px}}
  `}</style></section>;
}

// ── Dúvidas frequentes ────────────────────────────────────────────────────
// Blocos-arquivo em duas colunas no desktop (cada um é um <details> nativo,
// sem JavaScript), com selo de acento que gira ao abrir. Só existe com FAQ
// real cadastrado — nunca perguntas universais fingindo ser do negócio.
export function FaqPulse({ faqs, tema, tone = "dark", variant = 1 }: {
  faqs: DBFaq[]; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  if (faqs.length === 0) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="faq" className="pulse-faq"><Reveal><div className="pulse-faq__inner">
    <header className="pulse-faq__head">
      <span className="pulse-kicker">Dúvidas frequentes</span>
      <h2>Perguntas frequentes</h2>
      <p>As respostas abaixo foram cadastradas pela própria empresa.</p>
    </header>
    <div className="pulse-faq__list">
      {faqs.map(faq => <details className="pulse-faq__item" key={faq.id}>
        <summary><span>{faq.pergunta}</span><span aria-hidden="true"><Icon name="plus" size={18}/></span></summary>
        <p>{faq.resposta}</p>
      </details>)}
    </div>
  </div></Reveal><style>{`
    .pulse-faq{background:${p.bg};padding:112px 24px}
    .pulse-faq__inner{max-width:1120px;margin:0 auto}
    .pulse-faq .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-faq__head{max-width:620px;margin-bottom:38px}
    .pulse-faq h2{margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:clamp(28px,3.7vw,44px);line-height:1.06;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-faq__head>p{margin:14px 0 0;font-family:${font.body};font-size:15px;line-height:1.75;color:${p.textMuted};overflow-wrap:anywhere}
    .pulse-faq__list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
    .pulse-faq__item{border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card};padding:0 22px;min-width:0}
    .pulse-faq__item summary{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 0;cursor:pointer;list-style:none;font-family:${font.display};font-weight:800;font-size:17px;line-height:1.35;color:${p.text}}
    .pulse-faq__item summary::-webkit-details-marker{display:none}
    .pulse-faq__item summary>span:first-child{overflow-wrap:anywhere}
    .pulse-faq__item summary>span:last-child{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;background:${tema.primarySoft};color:${p.accent};transition:transform .25s}
    .pulse-faq__item[open] summary>span:last-child{transform:rotate(45deg)}
    .pulse-faq__item>p{margin:0 0 22px;font-family:${font.body};font-size:14.5px;line-height:1.75;color:${p.textMuted};overflow-wrap:anywhere}
    @media(max-width:820px){.pulse-faq{padding:88px 20px}.pulse-faq__list{grid-template-columns:1fr}}
  `}</style></section>;
}

// ── Contato ───────────────────────────────────────────────────────────────
// Duas colunas comerciais: à esquerda a chamada grande com o botão de acento
// em pílula, à direita a lista de canais REAIS cadastrados, cada um em um
// bloco com selo de ícone. Sem endereço, a lista simplesmente não existe.
export function ContatoPulse({ empresa, waLink, whatsappNumber, tema, tone = "light", variant = 1 }: {
  empresa: Empresa; waLink: string; whatsappNumber?: string; tema: Tema; tone?: Tone; variant?: 1 | 2;
}) {
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const linhas = [
    empresa.endereco ? { icone: <IcPin/>, rotulo: "Endereço", valor: empresa.endereco + (local ? ` — ${local}` : ""), href: null } : null,
    empresa.telefone ? { icone: <IcPhone/>, rotulo: "Telefone", valor: empresa.telefone, href: "tel:" + empresa.telefone } : null,
    empresa.email ? { icone: <IcMail/>, rotulo: "E-mail", valor: empresa.email, href: "mailto:" + empresa.email } : null,
    empresa.horario_funcionamento ? { icone: <IcClock/>, rotulo: "Atendimento", valor: empresa.horario_funcionamento, href: null } : null,
  ].filter(Boolean) as { icone: ReactNode; rotulo: string; valor: string; href: string | null }[];
  if (linhas.length === 0 && !whatsappNumber) return null;
  const p = paleta(tema, tone, variant);
  const font = { display: p.fonteDisplay, body: p.fonteCorpo };
  return <section id="contato" className="pulse-contact"><Reveal><div className="pulse-contact__inner">
    <div className="pulse-contact__head">
      <span className="pulse-kicker">Contato</span>
      <h2>{gerarTituloContato(local)}</h2>
      <p>Escolha o canal mais conveniente. Os dados abaixo são os cadastrados pela empresa.</p>
      {whatsappNumber && <a className="pulse-contact__cta" href={waLink} target="_blank" rel="noreferrer"><IcWa size={18}/>Chamar no WhatsApp</a>}
      {empresa.endereco?.trim() && empresa.google_maps_url && <a className="pulse-contact__map" href={empresa.google_maps_url} target="_blank" rel="noreferrer">Abrir no mapa →</a>}
    </div>
    {linhas.length > 0 && <ul className="pulse-contact__list">
      {linhas.map(linha => <li key={linha.rotulo}>
        <span className="pulse-contact__icon" aria-hidden="true">{linha.icone}</span>
        <div>
          <small>{linha.rotulo}</small>
          {linha.href ? <a href={linha.href}>{linha.valor}</a> : <strong>{linha.valor}</strong>}
        </div>
      </li>)}
    </ul>}
  </div></Reveal><style>{`
    .pulse-contact{background:${p.bg};padding:112px 24px}
    .pulse-contact__inner{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:44px;align-items:start}
    .pulse-contact .pulse-kicker{display:inline-block;color:${p.accent};font-family:${font.body};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    .pulse-contact h2{margin:20px 0 20px;font-family:${font.display};font-weight:800;font-size:clamp(30px,3.8vw,46px);line-height:1.06;letter-spacing:-.02em;color:${p.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-contact__head>p{margin:0 0 26px;font-family:${font.body};font-size:15.5px;line-height:1.8;color:${p.textMuted};max-width:420px;overflow-wrap:anywhere}
    .pulse-contact__cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 28px;border-radius:999px;background:${p.accent};color:${tone === "dark" ? tema.ink3 : "#ffffff"};text-decoration:none;font-family:${font.body};font-size:14px;font-weight:800;letter-spacing:.04em;transition:transform .16s}
    .pulse-contact__cta:hover{transform:translateY(-2px)}
    .pulse-contact__map{display:block;margin-top:16px;font-family:${font.body};font-size:13px;font-weight:700;color:${p.accent};text-decoration:none}
    .pulse-contact__list{display:grid;gap:12px;margin:0;padding:0;list-style:none}
    .pulse-contact__list li{display:flex;align-items:flex-start;gap:16px;min-width:0;padding:20px;border-radius:${tema.radius}px;border:1px solid ${p.line};background:${p.card}}
    .pulse-contact__icon{flex-shrink:0;width:42px;height:42px;border-radius:13px;background:${tema.primarySoft};color:${p.accent};display:flex;align-items:center;justify-content:center}
    .pulse-contact__list small{display:block;margin-bottom:4px;font-family:${font.body};font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${p.textMuted}}
    .pulse-contact__list strong,.pulse-contact__list a{font-family:${font.body};font-size:15px;font-weight:700;line-height:1.55;color:${p.text};text-decoration:none;overflow-wrap:anywhere}
    .pulse-contact__list a{border-bottom:1px solid ${p.line}}
    @media(max-width:860px){.pulse-contact{padding:88px 20px}.pulse-contact__inner{grid-template-columns:1fr;gap:30px}.pulse-contact__cta{width:100%}}
  `}</style></section>;
}

// ── Fecho ─────────────────────────────────────────────────────────────────
// Faixa escura com lavagem da cor da marca, título gigante centralizado e
// botão de acento em pílula — o fecho comercial do modelo. Só existe com
// WhatsApp ou telefone cadastrado (nunca um botão sem destino).
export function CtaFinalPulse({ empresa, waLink, whatsappNumber, titulo, subtitulo, ctaTexto, tema }: {
  empresa: Empresa; waLink: string; whatsappNumber?: string; titulo: string; subtitulo: string; ctaTexto: string; tema: Tema;
}) {
  if (!whatsappNumber && !empresa.telefone) return null;
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  return <section className="pulse-cta"><Reveal><div className="pulse-cta__inner">
    <h2>{titulo}</h2>
    <p>{subtitulo}</p>
    <div className="pulse-cta__actions">
      {whatsappNumber && <a className="pulse-cta__solid" href={waLink} target="_blank" rel="noreferrer"><IcWa size={18}/>{ctaTexto}</a>}
      {empresa.telefone && <a className="pulse-cta__line" href={"tel:" + empresa.telefone}><IcPhone/>{empresa.telefone}</a>}
    </div>
    <span className="pulse-cta__note">Resposta rápida, sem compromisso.</span>
  </div></Reveal><style>{`
    .pulse-cta{position:relative;overflow:hidden;background:${tema.ink};padding:112px 24px}
    .pulse-cta:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(760px 420px at 50% 0%,${tema.primarySoft},transparent 70%)}
    .pulse-cta__inner{position:relative;z-index:1;max-width:860px;margin:0 auto;text-align:center}
    .pulse-cta h2{margin:0 0 18px;font-family:${font.display};font-weight:800;font-size:clamp(32px,5vw,60px);line-height:1.02;letter-spacing:-.03em;color:${tema.text};text-wrap:balance;overflow-wrap:anywhere}
    .pulse-cta p{margin:0 auto 34px;max-width:560px;font-family:${font.body};font-size:16.5px;line-height:1.75;color:${tema.textMuted};overflow-wrap:anywhere}
    .pulse-cta__actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
    .pulse-cta__solid,.pulse-cta__line{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:58px;padding:0 30px;border-radius:999px;text-decoration:none;font-family:${font.body};font-size:14.5px;font-weight:800;letter-spacing:.04em;transition:transform .16s,background .2s,color .2s,border-color .2s}
    .pulse-cta__solid{background:${tema.primary};color:${tema.ink3};box-shadow:0 22px 48px -20px rgba(0,0,0,.8)}
    .pulse-cta__solid:hover{transform:translateY(-2px)}
    .pulse-cta__line{border:1px solid ${tema.line};color:${tema.text};overflow-wrap:anywhere}
    .pulse-cta__line:hover{border-color:${tema.primary};color:${tema.primary}}
    .pulse-cta__note{display:block;margin-top:20px;font-family:${font.body};font-size:12.5px;color:${tema.textFaint}}
    @media(max-width:620px){.pulse-cta{padding:86px 20px}.pulse-cta__actions{flex-direction:column}.pulse-cta__solid,.pulse-cta__line{width:100%}}
  `}</style></section>;
}

// ── Rodapé ────────────────────────────────────────────────────────────────
// Assinatura grande em Archivo, navegação e contato em colunas e redes em
// botões circulares. Endereço, horário e redes só aparecem quando existem no
// cadastro — nenhuma linha é preenchida com dado inventado.
export function FooterPulse({ empresa, nome, esp, navItems, tema }: {
  empresa: Empresa; nome: string; esp: string; navItems: SiteNavItem[]; tema: Tema;
}) {
  const font = { display: tema.fonteDisplay, body: tema.fonteCorpo };
  const local = [empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const redes = [
    empresa.instagram_url ? { href: empresa.instagram_url, label: "Instagram", icone: <IcInstagram/> } : null,
    empresa.facebook_url ? { href: empresa.facebook_url, label: "Facebook", icone: <IcFacebook/> } : null,
    empresa.linkedin_url ? { href: empresa.linkedin_url, label: "LinkedIn", icone: <IcLinkedin/> } : null,
    empresa.tiktok_url ? { href: empresa.tiktok_url, label: "TikTok", icone: <IcTiktok/> } : null,
  ].filter(Boolean) as { href: string; label: string; icone: ReactNode }[];
  return <footer className="pulse-footer"><div className="pulse-footer__inner">
    <div className="pulse-footer__brand">
      <strong>{nome}</strong>
      {esp && <span>{esp}</span>}
      {local && <span>{local}</span>}
    </div>
    <div className="pulse-footer__cols">
      {navItems.length > 0 && <nav aria-label="Seções do site">{navItems.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>}
      <div className="pulse-footer__contact">
        {empresa.telefone && <a href={"tel:" + empresa.telefone}><IcPhone/>{empresa.telefone}</a>}
        {empresa.email && <a href={"mailto:" + empresa.email}><IcMail/>{empresa.email}</a>}
        {empresa.endereco && <span><IcPin/>{empresa.endereco}</span>}
        {empresa.horario_funcionamento && <span><IcClock/>{empresa.horario_funcionamento}</span>}
      </div>
      {redes.length > 0 && <div className="pulse-footer__social">
        {redes.map(rede => <a key={rede.label} href={rede.href} target="_blank" rel="noreferrer" aria-label={rede.label}>{rede.icone}</a>)}
      </div>}
    </div>
    <div className="pulse-footer__base">
      <span>© {new Date().getFullYear()} {nome}. Todos os direitos reservados.</span>
      <span className="op-sig">Site feito com <b>OrganizaPro</b></span>
    </div>
  </div><style>{`
    .pulse-footer{background:${tema.ink3};padding:56px 24px 24px;border-top:1px solid ${tema.line};font-family:${font.body}}
    .pulse-footer__inner{max-width:1240px;margin:0 auto}
    .pulse-footer__brand strong{display:block;font-family:${font.display};font-size:clamp(28px,4vw,42px);font-weight:800;letter-spacing:-.03em;line-height:1;color:${tema.text};overflow-wrap:anywhere}
    .pulse-footer__brand span{display:block;margin-top:10px;font-size:12.5px;color:${tema.textFaint};overflow-wrap:anywhere}
    .pulse-footer__cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:28px;margin:38px 0 30px;padding:28px 0;border-top:1px solid ${tema.line};border-bottom:1px solid ${tema.line}}
    .pulse-footer nav,.pulse-footer__contact{display:flex;flex-direction:column;gap:11px;min-width:0}
    .pulse-footer nav a,.pulse-footer__contact a,.pulse-footer__contact span{font-size:13.5px;color:${tema.textMuted};text-decoration:none;overflow-wrap:anywhere}
    .pulse-footer__contact a,.pulse-footer__contact span{display:flex;align-items:flex-start;gap:9px}
    .pulse-footer nav a:hover,.pulse-footer__contact a:hover{color:${tema.primary}}
    .pulse-footer__social{display:flex;flex-wrap:wrap;gap:10px;align-content:start}
    .pulse-footer__social a{width:40px;height:40px;border-radius:13px;border:1px solid ${tema.line};display:flex;align-items:center;justify-content:center;color:${tema.textMuted};transition:border-color .2s,color .2s}
    .pulse-footer__social a:hover{border-color:${tema.primary};color:${tema.primary}}
    .pulse-footer__base{display:flex;justify-content:space-between;gap:16px;font-size:11px;color:${tema.textFaint}}
    .pulse-footer__base .op-sig b{color:${tema.primary};font-weight:700}
    @media(max-width:700px){.pulse-footer{padding:44px 20px 20px}.pulse-footer__cols{grid-template-columns:1fr;gap:22px;margin:28px 0 24px;padding:22px 0}.pulse-footer__base{flex-direction:column;gap:8px}}
  `}</style></footer>;
}
