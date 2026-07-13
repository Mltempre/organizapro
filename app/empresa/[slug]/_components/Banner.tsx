import Reveal from "./Reveal";
import { color, radius } from "../_lib/theme";

// Só renderiza com banner_url real cadastrado. Sem banner, a seção some
// por completo — nunca um placeholder decorativo no lugar dele.
export default function Banner({ bannerUrl, nome }: { bannerUrl?: string | null; nome: string }) {
  if (!bannerUrl) return null;
  return (
    <section style={{ padding: "0 24px", marginTop: -48, position: "relative", zIndex: 2 }}>
      <Reveal>
        <div style={{ maxWidth: 1180, margin: "0 auto", borderRadius: radius.lg, overflow: "hidden", border: `1px solid ${color.line}`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.5)" }}>
          <img src={bannerUrl} alt={`Banner — ${nome}`} style={{ width: "100%", height: "auto", maxHeight: 320, objectFit: "cover", display: "block" }}/>
        </div>
      </Reveal>
    </section>
  );
}
