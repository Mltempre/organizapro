export default function PageLoader({
  title = "Carregando...",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, gap: 18 }}>
      <style>{`@keyframes op-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        border: "3px solid rgba(74,155,176,0.15)", borderTopColor: "#4a9bb0",
        animation: "op-spin 1s linear infinite",
      }} />
      <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>{title}</p>
      {subtitle && <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>{subtitle}</p>}
    </div>
  );
}
