// Classes de design compartilhadas entre todas as seções da landing —
// evita duplicar a mesma regra CSS em cada componente. Usa as variáveis
// reais do produto (--bg, --accent, --surface, etc. de app/globals.css),
// a mesma fonte (DM Sans) e a mesma paleta do painel logado de verdade —
// a landing deixa de ter uma identidade visual própria e divergente.
export default function EstilosCompartilhados() {
  return (
    <style>{`
      .section-tag {
        display: inline-block; background: rgba(74,155,176,0.12); color: #4a9bb0;
        font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
        text-transform: uppercase; padding: 5px 14px; border-radius: 999px; margin-bottom: 14px;
      }
      .section-title {
        font-size: clamp(26px, 3.6vw, 40px); font-weight: 800; color: var(--text);
        line-height: 1.15; margin: 0 0 14px; text-wrap: balance;
      }
      .section-lead {
        font-size: clamp(14.5px, 1.6vw, 17px); color: var(--muted); line-height: 1.7;
        max-width: 580px; margin: 0 auto;
      }
      .card-soft {
        background: var(--surface); border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.08);
        transition: border-color 0.22s ease, transform 0.22s ease;
      }
      .card-soft:hover { border-color: rgba(74,155,176,0.4); transform: translateY(-3px); }

      .btn-main {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong)); color: #fff; border: none; border-radius: 12px;
        font-family: inherit; font-size: 15.5px; font-weight: 700; padding: 16px 30px;
        cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;
        box-shadow: 0 8px 24px rgba(31,78,95,0.4);
        text-decoration: none; text-align: center; line-height: 1.3; max-width: 100%;
      }
      .btn-main:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(31,78,95,0.55); }
      .btn-hero { animation: ctaGlow 2.8s ease-in-out infinite; }

      .btn-secondary {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 16px 26px; border-radius: 12px; font-size: 14.5px; font-weight: 700;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.14);
        color: var(--text); text-decoration: none; cursor: pointer; font-family: inherit;
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .btn-secondary:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.24); }

      .reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.7s ease, transform 0.7s ease; }
      .reveal-visible { opacity: 1; transform: translateY(0); }

      @keyframes ctaGlow {
        0%, 100% { box-shadow: 0 8px 24px rgba(31,78,95,0.4); }
        50%      { box-shadow: 0 12px 40px rgba(31,78,95,0.75); }
      }
      @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      .live-dot { animation: pulseDot 1.6s ease-in-out infinite; }

      html { scroll-behavior: smooth; }
      * { box-sizing: border-box; }
    `}</style>
  );
}
