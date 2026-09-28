import Nav from "./Nav";
import Hero from "./Hero";
import {
  SobreVertice, ProblemaVertice, DiferenciaisVertice, ProcessoVertice, ServicosVertice,
  GaleriaVertice, EquipeVertice, DepoimentosVertice, FaqVertice, ContatoVertice,
  CtaFinalVertice, FooterVertice,
} from "./Secoes";
import type { PropsDoSite } from "../types";

// ── MODELO VÉRTICE — composição ───────────────────────────────────────────
//
// Narrativa institucional: quem somos → a questão do visitante → princípios →
// método → oferta → contato estruturado → provas → dúvidas → contato → fecho.
// Nenhuma seção consulta banco: o orquestrador entrega tudo pronto e cada
// bloco desaparece sozinho quando não há dado real (Serviços sem serviço,
// Equipe sem equipe, FAQ sem FAQ...).
//
// A ordem abaixo é EXATAMENTE a de MODELOS.vertice.ordemDasSecoes
// (_lib/modelos.ts): é nessa mesma sequência que o orquestrador calcula o
// ritmo claro/escuro das seções. Trocar a ordem aqui sem trocar lá deixaria
// dois blocos do mesmo tom colados um no outro.
export default function Vertice(props: PropsDoSite) {
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
      <SobreVertice empresa={empresa} nome={nome} sobre={sobre} tema={tema} tone={tons.sobre?.tone} variant={tons.sobre?.variant}/>
      <ProblemaVertice familiaId={familiaId} tema={tema} ctaHref={waContato} ctaTexto="Conte com a gente para resolver isso" tone={tons.problema?.tone} variant={tons.problema?.variant}/>
      <DiferenciaisVertice familiaId={familiaId} tema={tema} tone={tons.diferenciais?.tone} variant={tons.diferenciais?.variant}/>
      <ProcessoVertice familiaId={familiaId} tema={tema} tone={tons.processo?.tone} variant={tons.processo?.variant}/>
      <ServicosVertice servicos={servicos} empresa={empresa} tema={tema} familiaId={familiaId} waBase={waBase} codigoRastreio={codigoRastreio} tone={tons.servicos?.tone} variant={tons.servicos?.variant}/>
      {blocoPublico}
      <GaleriaVertice antesDepois={antesDepois} galeria={galeria} estrutura={estrutura} empresa={empresa} tema={tema} tone={tons.galeria?.tone} variant={tons.galeria?.variant}/>
      <EquipeVertice equipe={equipe} tema={tema} tone={tons.equipe?.tone} variant={tons.equipe?.variant}/>
      <DepoimentosVertice depoimentos={depoimentos} tema={tema} tone={tons.depoimentos?.tone} variant={tons.depoimentos?.variant}/>
      <FaqVertice faqs={faqs} tema={tema} tone={tons.faq?.tone} variant={tons.faq?.variant}/>
      {temContato && <ContatoVertice empresa={empresa} waLink={waContato} whatsappNumber={whatsappNumber} tema={tema} tone={tons.contato?.tone} variant={tons.contato?.variant}/>}
      <CtaFinalVertice
        empresa={empresa} waLink={waFinal} whatsappNumber={whatsappNumber} tema={tema}
        titulo={pedeOrcamento ? "Vamos analisar o seu caso." : "Seu próximo passo pode começar agora."}
        subtitulo="Fale com quem conduz o atendimento — sem intermediário."
        ctaTexto={pedeOrcamento ? "Solicitar orçamento" : "Falar no WhatsApp"}
      />
      <FooterVertice empresa={empresa} nome={nome} esp={esp} navItems={navItems} tema={tema}/>
    </>
  );
}
