import Reveal from "./Reveal";
import type { Tema } from "../_lib/families";

// Só renderiza com banner_url real cadastrado. Sem banner, a seção some
// por completo — nunca um placeholder decorativo no lugar dele.
export default function Banner({ bannerUrl, nome, tema }: { bannerUrl?: string | null; nome: string; tema: Tema }) {
  if (!bannerUrl) return null;
  return (
    <section style={{ padding: "0 24px", marginTop: -48, position: "relative", zIndex: 2 }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto", borderRadius: tema.radius, overflow: "hidden", border: `1px solid ${tema.line}`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.5)" }}>
          <img src={bannerUrl} alt={`Banner — ${nome}`} style={{ width: "100%", height: "auto", maxHeight: 320, objectFit: "cover", display: "block" }}/>
        </div>
      </Reveal>
    </section>
  );
}
