const testimonials = [
  {
    name: "Lucas S.",
    text: "Melhor barbearia da cidade! Atendimento impecável, ambiente premium e profissionais incríveis.",
  },
  {
    name: "Rafael M.",
    text: "Experiência diferenciada, corte perfeito e ambiente moderno. Recomendo demais!",
  },
  {
    name: "Thiago P.",
    text: "Nunca fui tão bem atendido. A barbearia realmente entrega o que promete!",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="w-full max-w-3xl mx-auto py-12 px-4">
      <h2 className="text-2xl md:text-4xl font-bold mb-8 text-cyan-400 text-center drop-shadow-[0_2px_24px_rgba(0,255,255,0.10)]">
        Depoimentos
      </h2>
      <div className="flex flex-col gap-8">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="bg-[#181a20] rounded-2xl p-8 shadow-lg border border-cyan-400/10"
          >
            <p className="text-gray-200 text-lg mb-4 font-medium">“{t.text}”</p>
            <span className="block text-cyan-400 font-bold">{t.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
