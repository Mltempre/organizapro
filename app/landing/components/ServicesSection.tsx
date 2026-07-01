const services = [
  {
    title: "Corte Premium",
    desc: "Corte moderno, alinhado às tendências e ao seu estilo.",
  },
  {
    title: "Barba Design",
    desc: "Barba desenhada, acabamento perfeito e hidratação.",
  },
  {
    title: "Sobrancelha",
    desc: "Detalhe e simetria para realçar seu visual.",
  },
  {
    title: "Tratamentos",
    desc: "Cuidados especiais para cabelo e barba.",
  },
];

export default function ServicesSection() {
  return (
    <section className="w-full max-w-4xl mx-auto py-12 px-4">
      <h2 className="text-2xl md:text-4xl font-bold mb-8 text-cyan-400 text-center drop-shadow-[0_2px_24px_rgba(0,255,255,0.10)]">
        Serviços Exclusivos
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {services.map((service) => (
          <div
            key={service.title}
            className="bg-[#181a20] rounded-2xl p-8 shadow-lg border border-cyan-400/10 hover:border-cyan-400/40 transition-all duration-200"
          >
            <h3 className="text-xl font-semibold mb-2 text-white">{service.title}</h3>
            <p className="text-gray-300">{service.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
