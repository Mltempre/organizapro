import LandingPage from "../components/LandingPage";

export const metadata = {
  title: "ClínicaFlow para Clínicas de Estética — Reduza faltas e aumente avaliações",
  description:
    "O ClínicaFlow confirma agendamentos pelo WhatsApp, recupera clientes faltantes e aumenta as avaliações Google da sua clínica de estética automaticamente.",
};

export default function EsteticaPage() {
  return (
    <LandingPage
      specialty="Estética"
      heroBadge="312 clínicas de estética ativas"
      heroTitle="Reduza faltas na sua clínica de estética e fidelize mais clientes automaticamente."
      heroSubtitle="O ClínicaFlow confirma agendamentos pelo WhatsApp, recupera clientes faltantes e faz sua clínica de estética crescer — sem contratar ninguém."
      wppMessageDefault="Olá, quero solicitar uma demonstração da ClínicaFlow para minha clínica de estética."
      dashboardDoctorName="Dra. Camila Rocha"
      ctaTitle="Pronto para transformar\nsua clínica de estética?"
      testimonials={[
        {
          name: "Camila Rocha",
          role: "Esteticista",
          city: "São Paulo, SP",
          avatar: "C",
          text: "Minha clínica tinha um problema sério com no-shows nos procedimentos de alta complexidade. Com o ClínicaFlow os lembretes automáticos reduziram as faltas em 68% no primeiro mês. Recuperei o investimento em uma semana.",
          stars: 5,
          metric: "−68% de no-shows",
        },
        {
          name: "Fernanda Lima",
          role: "Biomédica Esteta",
          city: "Curitiba, PR",
          avatar: "F",
          text: "O que mais me surpreendeu foi o aumento de avaliações no Google. Em 6 semanas saí de 4.1 para 4.8 estrelas. O sistema pede o feedback automaticamente e meus novos clientes chegam porque viram as avaliações.",
          stars: 5,
          metric: "4.1 → 4.8 ⭐",
        },
        {
          name: "Juliana Martins",
          role: "Clínica de Estética Avançada",
          city: "Rio de Janeiro, RJ",
          avatar: "J",
          text: "Trabalho com procedimentos estéticos premium e o reengajamento automático de pacientes inativos foi um diferencial enorme. O sistema lembra clientes que não vieram há 3 meses e traz eles de volta.",
          stars: 5,
          metric: "+29 reativações/mês",
        },
      ]}
      faqItems={[
        {
          q: "Funciona para todos os tipos de procedimentos estéticos?",
          a: "Sim! Harmonização facial, limpeza de pele, laser, drenagem linfática, botox e muito mais. O sistema se adapta ao seu menu de serviços.",
        },
        {
          q: "Como funciona o lembrete de agendamentos?",
          a: "O ClínicaFlow envia lembretes automáticos pelo WhatsApp 48h e 2h antes do procedimento, pedindo confirmação. Clientes que não respondem recebem um segundo lembrete.",
        },
        {
          q: "O sistema ajuda a conseguir mais avaliações no Google?",
          a: "Sim. Após cada atendimento concluído, o ClínicaFlow envia automaticamente uma mensagem pedindo avaliação no Google, aumentando a reputação da sua clínica de estética e ajudando a atrair novos clientes.",
        },
        {
          q: "Preciso instalar aplicativo ou ter conhecimento técnico?",
          a: "Não. A configuração é simples e nossa equipe ajuda na implantação. Você acessa tudo pelo painel e acompanha clientes, agendamentos, confirmações e avaliações.",
        },
        {
          q: "Como funciona a demonstração personalizada?",
          a: "Trabalhamos com demonstração personalizada e implantação assistida para mostrar exatamente como o ClínicaFlow funciona na rotina da sua clínica de estética.",
        },
        {
          q: "Posso cancelar quando quiser?",
          a: "Sim. Sem fidelidade e sem multa. Você pode cancelar quando quiser.",
        },
      ]}
    />
  );
}