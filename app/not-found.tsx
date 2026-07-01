export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#334155", padding: 24 }}>
      <div style={{ maxWidth: 520, textAlign: "center", background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😕</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 16px" }}>Página não encontrada</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#475569", margin: 0 }}>
          O site que você tentou acessar não existe ou não está disponível. Verifique o link ou retorne para a área administrativa.
        </p>
      </div>
    </div>
  );
}
