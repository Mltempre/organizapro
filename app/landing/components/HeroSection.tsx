"use client";

import { FaWhatsapp, FaInstagram } from "react-icons/fa";

export default function HeroSection() {
  return (
    <section className="relative w-full flex flex-col items-center justify-center min-h-[80vh] py-16 px-4 text-center overflow-hidden bg-gradient-to-b from-[#10121a] via-[#181a20] to-[#0f1014]">
      {/* Glow e luzes de fundo */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-cyan-400/20 blur-[120px] rounded-full pointer-events-none animate-pulse z-0" />
      <div className="absolute top-1/3 left-1/4 w-60 h-60 bg-fuchsia-500/10 blur-[90px] rounded-full pointer-events-none animate-pulse z-0" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none animate-pulse z-0" />

      <h1 className="relative z-10 text-4xl md:text-7xl font-black mb-6 tracking-tight bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-white bg-clip-text text-transparent drop-shadow-[0_2px_32px_rgba(34,211,238,0.18)] animate-fadeInUp">
        <span className="block">Barbearia</span>
        <span className="block text-cyan-400 drop-shadow-[0_2px_32px_rgba(34,211,238,0.25)]">Premium</span>
      </h1>
      <p className="relative z-10 text-lg md:text-2xl text-gray-300 mb-10 max-w-xl mx-auto font-medium animate-fadeInUp delay-100">
        Visual moderno, atendimento de excelência e experiência única para você.<br className="hidden md:inline" /> Reserve seu horário agora!
      </p>
      <div className="relative z-10 flex gap-4 justify-center mb-10 animate-fadeInUp delay-200">
        <a
          href="https://wa.me/SEUNUMERO" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500 text-black font-extrabold shadow-[0_0_32px_0_rgba(34,211,238,0.18)] text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 border-2 border-cyan-400/30 hover:scale-105"
        >
          <FaWhatsapp size={24} /> WhatsApp
        </a>
        <a
          href="https://instagram.com/SEUINSTAGRAM" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 hover:from-pink-400 hover:to-cyan-300 text-white font-extrabold shadow-[0_0_32px_0_rgba(236,72,153,0.18)] text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-400/60 border-2 border-pink-400/30 hover:scale-105"
        >
          <FaInstagram size={24} /> Instagram
        </a>
      </div>
      <div className="relative z-10 animate-fadeInUp delay-300">
        <span className="inline-block px-6 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/20 to-purple-500/20 text-cyan-200 font-semibold text-sm tracking-wide shadow-lg backdrop-blur-md border border-cyan-400/10">
          Atendimento premium • Experiência única • Visual de impacto
        </span>
      </div>

      {/* Animações utilitárias */}
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 1.1s cubic-bezier(.4,1.6,.6,1) both; }
        .delay-100 { animation-delay: .12s; }
        .delay-200 { animation-delay: .22s; }
        .delay-300 { animation-delay: .32s; }
      `}</style>
    </section>
  );
}
