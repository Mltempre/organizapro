import LandingPage from "../components/LandingPage";

export const metadata = {
  title: "ClínicaFlow para Dermatologistas — Reduza faltas e aumente avaliações",
  description:
    "O ClínicaFlow confirma consultas pelo WhatsApp, recupera pacientes faltantes e aumenta as avaliações Google do seu consultório dermatológico automaticamente.",
};

export default function DermatologistaPage() {
  return (
    <LandingPage
      specialty="Dermatologia"
      heroBadge="312 consultórios dermatológicos ativos"
      heroTitle="Reduza faltas no seu consultório dermatológico e aumente avaliações automaticamente."
      heroSubtitle="O ClínicaFlow confirma consultas pelo WhatsApp, recupera pacientes faltantes e faz seu consultório de dermatologia crescer — sem contratar ninguém."
      wppMessageDefault="Olá, quero solicitar uma demonstração da ClínicaFlow para meu consultório de dermatologia."
      dashboardDoctorName="Dra. Mariana Lopes"
      ctaTitle="Pronto para transformar\nseu consultório de dermatologia?"
      testimonials={[
        {
          name: "Dra. Mariana Lopes",
          role: "Dermatologista",
          city: "Florianópolis, SC",
          avatar: "M",
          text: "O que mais me surpreendeu foi a facilidade de configuração. Em 15 minutos já estava funcionando. As faltas nas consultas de retorno para procedimentos como peeling e laser caíram drasticamente.",
          stars: 5,
          metric: "Setup em 15 min",
        },
        {
          name: "Dr. Rafael Cunha",
          role: "Dermatologista",
          city: "Porto Alegre, RS",
          avatar: "R",
          text: "Tenho pacientes com tratamentos longos para acne e rosácea. O ClínicaFlow me ajuda a manter o paciente engajado durante todo o tratamento, com lembretes personalizados. Minha taxa de adesão subiu 55%.",
          stars: 5,
          metric: "+55% adesão",
        },
        {
          name: "Dra. Beatriz Alves",
          role: "Dermatologista",
          city: "Brasília, DF",
          avatar: "B",
          text: "Trabalho com muitos procedimentos estéticos dermatológicos de alto ticket. Com o sistema de reengajamento automático, consigo reativar pacientes que fizeram botox há 6 meses. Excelente ROI.",
          stars: 5,
          metric: "R$9.200 recuperados",
        },
      ]}
      faqItems={[
        {
          q: "Funciona para dermatologia clínica e estética?",
          a: "Sim! Atende consultas dermatológicas, procedimentos estéticos (botox, preenchimento, laser, peeling), acompanhamento de tratamentos e muito mais.",
        },
        {
          q: "Como funciona o lembrete de retorno para procedimentos?",
          a: "O sistema envia automaticamente lembretes de retorno programados (30, 60 ou 90 dias) após procedimentos, garantindo que o paciente complete o tratamento.",
        },
        {
          q: "O sistema ajuda a conseguir mais avaliações no Google?",
          a: "Sim. Após cada consulta ou procedimento concluído, o ClínicaFlow envia automaticamente uma mensagem pedindo avaliação no Google, aumentando a reputação do seu consultório e ajudando a atrair novos pacientes.",
        },
        {
          q: "Preciso instalar aplicativo ou ter conhecimento técnico?",
          a: "Não. A configuração é simples e nossa equipe ajuda na implantação. Você acessa tudo pelo painel e acompanha pacientes, agendamentos, confirmações e avaliações.",
        },
        {
          q: "Como funciona a demonstração personalizada?",
          a: "Trabalhamos com demonstração personalizada e implantação assistida para mostrar exatamente como o ClínicaFlow funciona na rotina do seu consultório dermatológico.",
        },
        {
          q: "Posso cancelar quando quiser?",
          a: "Sim. Sem fidelidade e sem multa. Você pode cancelar quando quiser.",
        },
      ]}
    />
  );
}