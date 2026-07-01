export default function Page() {
  const stats = [
    { label: "Pacientes Ativos", value: "248", subtitle: "Fluxo saudável", gradient: "linear-gradient(135deg,#5b5dff,#8f3dff)" },
    { label: "Consultas Hoje", value: "18", subtitle: "Agenda dinâmica", gradient: "linear-gradient(135deg,#00bcd4,#3b82f6)" },
    { label: "94% Taxa de Confirmação", value: "94%", subtitle: "Compromisso real", gradient: "linear-gradient(135deg,#6366f1,#a855f7)" },
    { label: "4.9 ⭐ Avaliação Média", value: "4.9", subtitle: "Confiança clínica", gradient: "linear-gradient(135deg,#f97316,#facc15)" },
  ];

  const results = [
    "✅ 37 consultas recuperadas",
    "✅ 94% de confirmações",
    "✅ 4.9 estrelas de satisfação",
    "✅ 248 pacientes ativos",
  ];

  const whatsappItems = [
    "✓ Lembrete 24h antes",
    "✓ Confirmação automática",
    "✓ Pedido de avaliação Google",
    "✓ Recuperação de pacientes faltosos",
  ];

  const beforeAfter = [
    {
      title: "ANTES",
      items: [
        "❌ Pacientes esquecem consultas",
        "❌ Agenda desorganizada",
        "❌ Poucas avaliações",
      ],
      bg: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    },
    {
      title: "DEPOIS",
      items: [
        "✅ Confirmações automáticas",
        "✅ Agenda organizada",
        "✅ Mais avaliações Google",
      ],
      bg: "rgba(16,185,129,0.12)",
      border: "1px solid rgba(16,185,129,0.3)",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top, #0c1532 0%, #050811 45%, #030712 100%)", color: "#fff", fontFamily: "Inter,system-ui,sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: 40, padding: "0 10px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "8px 16px", marginBottom: 18 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", color: "#a5b4fc" }}>DEMO PREMIUM</span>
          </div>
          <h1 style={{ fontSize: "clamp(36px,4vw,64px)", fontWeight: 900, margin: "0 0 18px", lineHeight: 1.05 }}>Sua clínica está pronta para crescer 🚀</h1>
          <p style={{ fontSize: 18, maxWidth: 760, margin: "0 auto 12px", lineHeight: 1.7, color: "rgba(255,255,255,0.8)" }}>Reduza faltas, aumente confirmações e acompanhe os resultados da sua clínica em tempo real.</p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0 }}>Demonstração ilustrativa da plataforma.</p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24, marginBottom: 36 }}>
          {stats.map((item) => (
            <div key={item.label} style={{ position: "relative", overflow: "hidden", borderRadius: 32, padding: 28, minHeight: 220, background: item.gradient, boxShadow: "0 28px 60px rgba(10,20,60,0.28)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(14px)", color: "#fff", transition: "transform .3s, box-shadow .3s" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 32%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -20, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, opacity: 0.92 }}>{item.label}</div>
                <div style={{ fontSize: 52, fontWeight: 900, marginBottom: 12, lineHeight: 1 }}>{item.value}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{item.subtitle}</div>
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: 24, marginBottom: 36 }}>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 32, padding: 32, boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#c7d2fe", marginBottom: 18 }}>RESULTADOS DO ÚLTIMO MÊS</div>
            <div style={{ display: "grid", gap: 16 }}>
              {results.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 22, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 20 }}>{item.startsWith("✅") ? "✅" : ""}</span>
                  <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{item.slice(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "linear-gradient(180deg, rgba(37,99,235,0.12) 0%, rgba(79,70,229,0.08) 100%)", borderRadius: 32, padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 24px 48px rgba(0,0,0,0.14)" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>WhatsApp Automatizado</div>
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 24, padding: 20, color: "#e5e7eb", lineHeight: 1.8, fontSize: 15 }}>
                <div style={{ marginBottom: 12, fontWeight: 700, color: "#fff" }}>Conversa simulada</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {whatsappItems.map((item) => (
                    <div key={item} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 18, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
          {beforeAfter.map((block) => (
            <div key={block.title} style={{ background: block.bg, border: block.border, borderRadius: 28, padding: 28, minHeight: 240, boxShadow: "0 18px 42px rgba(0,0,0,0.12)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: "#fff" }}>{block.title}</div>
              <div style={{ display: "grid", gap: 12 }}>
                {block.items.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, color: "rgba(255,255,255,0.9)" }}>
                    <span style={{ width: 24, textAlign: "center" }}>{item.startsWith("❌") ? "❌" : "✅"}</span>
                    <span>{item.slice(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <div style={{ textAlign: "center", padding: "32px 20px", borderRadius: 32, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>Exiba um atendimento premium e fale direto com a equipe ClínicaFlow via WhatsApp.</p>
          <a
            href="https://wa.me/5541988379119"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "linear-gradient(135deg,#6366f1,#2563eb)",
              color: "#fff",
              textDecoration: "none",
              padding: "16px 28px",
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 800,
              boxShadow: "0 18px 40px rgba(37,99,235,0.28)",
              transition: "transform .2s, box-shadow .2s",
            }}
          >
            Agendar Demonstração
          </a>
        </div>
      </div>
    </div>
  );
}
