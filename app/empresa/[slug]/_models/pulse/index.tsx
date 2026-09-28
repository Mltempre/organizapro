import Nav from "./Nav";
import Hero from "./Hero";
import {
  ServicosPulse, ProblemaPulse, SobrePulse, DiferenciaisPulse, GaleriaPulse,
  DepoimentosPulse, EquipePulse, ProcessoPulse, FaqPulse, ContatoPulse,
  CtaFinalPulse, FooterPulse,
} from "./Secoes";
import type { PropsDoSite } from "../types";

// ── MODELO PULSE — composição ─────────────────────────────────────────────
//
// Narrativa comercial: OFERTA logo depois do hero, depois o contexto (problema
// → quem somos → princípios), as provas visuais e sociais, o "como funciona" e
// o contato — praticamente o inverso da ordem institucional do Vértice.
//
// A ordem abaixo é EXATAMENTE a de MODELOS.pulse.ordemDasSecoes
// (_lib/modelos.ts), a mesma sequência em que o orquestrador calculou o ritmo
// claro/escuro (o Pulse abre em escuro, emendando no hero fotografado).
export default function Pulse(props: PropsDoSite) {
  const {
    empresa, nome, esp, local, sobre, titulo, subtitulo, tema, tons, navItems,
    servicos, galeria, estrutura, antesDepois, equipe, depoimentos, faqs,
    waHero, waContato, waFinal, waBase, whatsappNumber, mediaHero, codigoRastreio,
    temContato, blocoPublico, ctaMsgs,
  } = props;
  const familiaId = tema.id;
  const pedeOrcamento = ctaMsgs.final.includes("orçamento");

  return (
    <>
      <Nav empresa={empresa} nome={nome} logoUrl={empresa.logo_url} waLink={waHero} whatsappNumber={whatsappNumber} navItems={navItems} tema={tema}/>
      <Hero empresa={empresa} esp={esp} local={local} titulo={titulo} subtitulo={subtitulo} waLink={waHero} whatsappNumber={whatsappNumber} mediaUrl={mediaHero} hasServices={servicos.length > 0} tema={tema}/>
      <ServicosPulse servicos={servicos} empresa={empresa} tema={tema} familiaId={familiaId} waBase={waBase} codigoRastreio={codigoRastreio} tone={tons.servicos?.tone} variant={tons.servicos?.variant}/>
      <ProblemaPulse familiaId={familiaId} tema={tema} ctaHref={waContato} ctaTexto="Chamar a gente agora" tone={tons.problema?.tone} variant={tons.problema?.variant}/>
      <SobrePulse empresa={empresa} nome={nome} sobre={sobre} tema={tema} tone={tons.sobre?.tone} variant={tons.sobre?.variant}/>
      <DiferenciaisPulse familiaId={familiaId} tema={tema} tone={tons.diferenciais?.tone} variant={tons.diferenciais?.variant}/>
      {blocoPublico}
      <GaleriaPulse antesDepois={antesDepois} galeria={galeria} estrutura={estrutura} empresa={empresa} tema={tema} tone={tons.galeria?.tone} variant={tons.galeria?.variant}/>
      <DepoimentosPulse depoimentos={depoimentos} tema={tema} tone={tons.depoimentos?.tone} variant={tons.depoimentos?.variant}/>
      <EquipePulse equipe={equipe} tema={tema} tone={tons.equipe?.tone} variant={tons.equipe?.variant}/>
      <ProcessoPulse familiaId={familiaId} tema={tema} tone={tons.processo?.tone} variant={tons.processo?.variant}/>
      <FaqPulse faqs={faqs} tema={tema} tone={tons.faq?.tone} variant={tons.faq?.variant}/>
      {temContato && <ContatoPulse empresa={empresa} waLink={waContato} whatsappNumber={whatsappNumber} tema={tema} tone={tons.contato?.tone} variant={tons.contato?.variant}/>}
      <CtaFinalPulse
        empresa={empresa} waLink={waFinal} whatsappNumber={whatsappNumber} tema={tema}
        titulo={pedeOrcamento ? "Peça seu orçamento agora." : "Vamos marcar o seu horário?"}
        subtitulo="Fale com a gente pelo WhatsApp — resposta rápida e sem compromisso."
        ctaTexto={pedeOrcamento ? "Solicitar orçamento" : "Chamar no WhatsApp"}
      />
      <FooterPulse empresa={empresa} nome={nome} esp={esp} navItems={navItems} tema={tema}/>
    </>
  );
}
