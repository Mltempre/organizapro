export default function CTASection() {
  return (
    <section className="w-full flex flex-col items-center justify-center py-16 px-4 text-center relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-60 bg-cyan-400/10 blur-2xl rounded-full pointer-events-none animate-pulse" />
      <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-white drop-shadow-[0_2px_24px_rgba(0,255,255,0.15)]">
        Agende seu horário agora!
      </h2>
      <p className="text-lg md:text-2xl text-gray-300 mb-8 max-w-xl mx-auto">
        Garanta seu atendimento premium e viva a experiência de uma barbearia moderna.
      </p>
      <a
        href="https://wa.me/SEUNUMERO" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 px-8 py-4 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-xl text-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
      >
        Reservar pelo WhatsApp
      </a>
    </section>
  );
}
