import LandingPage from "../components/LandingPage";

export const metadata = {
  title: "OrganizaPro para Dentistas — Reduza faltas e aumente avaliações",
  description:
    "O OrganizaPro confirma consultas pelo WhatsApp, reduz faltas na agenda odontológica e aumenta as avaliações Google do seu consultório automaticamente.",
};

export default function DentistaPage() {
  return (
    <LandingPage
      specialty="Dentista"
      heroBadge="312 clínicas odontológicas ativas"
      heroTitle="Reduza faltas no seu consultório odontológico e aumente suas avaliações no Google."
      heroSubtitle="O OrganizaPro confirma atendimentos pelo WhatsApp, recupera clientes faltantes e ajuda sua clínica odontológica a crescer sem contratar recepcionista extra."
      wppMessageDefault="Olá, quero solicitar uma demonstração do OrganizaPro para minha clínica odontológica."
      dashboardOwnerName="Rafael Almeida"
      ctaTitle="Pronto para transformar\nsua clínica odontológica?"
      testimonials={[
        {
          name: "Rafael Almeida",
          role: "Cirurgião-Dentista",
          city: "Belo Horizonte, MG",
          avatar: "R",
          text: "Antes do OrganizaPro, minha agenda tinha muitas faltas em consultas de avaliação e retorno. Com os lembretes automáticos pelo WhatsApp, os clientes confirmam com facilidade e minha recepção ganhou muito tempo.",
          stars: 5,
          metric: "−62% de faltas",
        },
        {
          name: "Mariana Torres",
          role: "Ortodontista",
          city: "Campinas, SP",
          avatar: "M",
          text: "O sistema ajudou muito nos retornos de manutenção ortodôntica. Os clientes recebem a confirmação automática, a equipe acompanha tudo no painel e conseguimos reduzir buracos na agenda.",
          stars: 5,
          metric: "+34 confirmações/mês",
        },
        {
          name: "Eduardo Nogueira",
          role: "Clínica Odontológica",
          city: "Curitiba, PR",
          avatar: "E",
          text: "A parte de avaliações no Google foi o diferencial. Depois dos atendimentos concluídos, o OrganizaPro envia a mensagem automaticamente. Em pouco tempo começamos a receber mais avaliações e mais clientes novos.",
          stars: 5,
          metric: "4.2 → 4.8 ⭐",
        },
      ]}
      faqItems={[
        {
          q: "Funciona para clínicas odontológicas e consultórios individuais?",
          a: "Sim. O OrganizaPro funciona para dentistas autônomos, clínicas odontológicas, ortodontistas, implantodontistas, clínicas populares e consultórios particulares.",
        },
        {
          q: "Como o sistema reduz faltas na agenda?",
          a: "O OrganizaPro envia lembretes automáticos pelo WhatsApp antes do atendimento, pede confirmação do cliente e ajuda a equipe a identificar quem confirmou, quem não respondeu e quem precisa reagendar.",
        },
        {
          q: "O sistema ajuda a conseguir mais avaliações no Google?",
          a: "Sim. Após atendimentos concluídos, o OrganizaPro envia automaticamente uma mensagem pedindo avaliação no Google, aumentando a reputação da clínica e ajudando a atrair novos clientes.",
        },
        {
          q: "Preciso instalar aplicativo ou ter conhecimento técnico?",
          a: "Não. A configuração é simples e nossa equipe ajuda na implantação. Você acessa tudo pelo painel e acompanha clientes, agendamentos, confirmações e avaliações.",
        },
        {
          q: "Tem teste grátis?",
          a: "Trabalhamos com demonstração e implantação assistida para mostrar exatamente como o OrganizaPro funciona na rotina da sua clínica.",
        },
        {
          q: "Posso cancelar quando quiser?",
          a: "Sim. Sem fidelidade e sem multa. Você pode cancelar quando quiser.",
        },
      ]}
    />
  );
}
