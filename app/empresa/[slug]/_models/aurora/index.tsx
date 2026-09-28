import Header from "../../_components/Header";
import Hero from "../../_components/Hero";
import Banner from "../../_components/Banner";
import Problema from "../../_components/Problema";
import Sobre from "../../_components/Sobre";
import Diferenciais from "../../_components/Diferenciais";
import Processo from "../../_components/Processo";
import Servicos from "../../_components/Servicos";
import Galeria from "../../_components/Galeria";
import Equipe from "../../_components/Equipe";
import Depoimentos from "../../_components/Depoimentos";
import Faq from "../../_components/Faq";
import Contato from "../../_components/Contato";
import CtaFinal from "../../_components/CtaFinal";
import Footer from "../../_components/Footer";
import type { PropsDoSite } from "../types";

// ── MODELO AURORA — composição ────────────────────────────────────────────
//
// Ordem narrativa: apresentação → contexto → quem somos → princípios → como
// funciona → o que oferecemos → contato estruturado → imagens → equipe →
// provas → dúvidas → contato → fecho. O ritmo claro/escuro de cada seção vem
// calculado do orquestrador (só entre as seções que realmente aparecem), e
// cada pedaço desta composição tem marcador visual próprio — cabeçalho em
// vidro claro, hero em malha de gradiente, sobre em três colunas, serviços em
// grade editorial, galeria em mosaico.
export default function Aurora(props: PropsDoSite) {
  const { empresa, nome, esp, local, sobre, titulo, subtitulo, tema, tons, navItems, servicos, galeria, estrutura, antesDepois, equipe, depoimentos, faqs, waHero, waContato, waFinal, waBase, whatsappNumber, mediaHero, codigoRastreio, temContato, blocoPublico } = props;
  const familiaId = tema.id;
  return (
    <>
      <Header nome={nome} logoUrl={empresa.logo_url} waLink={waHero} whatsappNumber={whatsappNumber} navItems={navItems} tema={tema}/>
      <Hero empresa={empresa} esp={esp} local={local} titulo={titulo} subtitulo={subtitulo} waLink={waHero} whatsappNumber={whatsappNumber} mediaUrl={mediaHero} hasServices={servicos.length > 0} tema={tema}/>
      <Banner bannerUrl={empresa.hero_url ? empresa.banner_url : null} nome={nome} tema={tema}/>
      <Problema familiaId={familiaId} tema={tema} ctaHref={waContato} ctaTexto="Conte com a gente para resolver isso" tone={tons.problema?.tone} variant={tons.problema?.variant}/>
      <Sobre empresa={empresa} nome={nome} sobre={sobre} tema={tema} tone={tons.sobre?.tone} variant={tons.sobre?.variant}/>
      <Diferenciais familiaId={familiaId} tema={tema} tone={tons.diferenciais?.tone} variant={tons.diferenciais?.variant}/>
      <Processo familiaId={familiaId} tema={tema} tone={tons.processo?.tone} variant={tons.processo?.variant}/>
      <Servicos servicos={servicos} empresa={empresa} tema={tema} familiaId={familiaId} waBase={waBase} codigoRastreio={codigoRastreio} tone={tons.servicos?.tone} variant={tons.servicos?.variant}/>
      {blocoPublico}
      <Galeria antesDepois={antesDepois} galeria={galeria} estrutura={estrutura} empresa={empresa} tema={tema} tone={tons.galeria?.tone} variant={tons.galeria?.variant}/>
      <Equipe equipe={equipe} tema={tema} tone={tons.equipe?.tone} variant={tons.equipe?.variant}/>
      <Depoimentos depoimentos={depoimentos} tema={tema} tone={tons.depoimentos?.tone} variant={tons.depoimentos?.variant}/>
      <Faq faqs={faqs} tema={tema} tone={tons.faq?.tone} variant={tons.faq?.variant}/>
      {temContato && <Contato empresa={empresa} waLink={waContato} whatsappNumber={whatsappNumber} tema={tema} tone={tons.contato?.tone} variant={tons.contato?.variant}/>}
      <CtaFinal empresa={empresa} waLink={waFinal} whatsappNumber={whatsappNumber} titulo="Seu próximo passo pode começar agora." subtitulo="Entre em contato pelo canal que for mais conveniente para você." ctaTexto={props.ctaMsgs.final.includes("orçamento") ? "Solicitar orçamento" : "Falar no WhatsApp"} tema={tema}/>
      <Footer empresa={empresa} nome={nome} esp={esp} waLink={waFinal} whatsappNumber={whatsappNumber} navItems={navItems} tema={tema}/>
    </>
  );
}
