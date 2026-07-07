export default function ChecklistItem({
  label, done, onClick,
}: {
  label: string;
  done: boolean;
  onClick?: () => void;
}) {
  const interativo = !!onClick && !done;
  return (
    <div
      className={interativo ? "ob-item-hover" : undefined}
      onClick={interativo ? onClick : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 6px", borderRadius: 8,
        cursor: interativo ? "pointer" : "default",
        transition: "background 0.15s",
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700,
        background: done ? "#4ade80" : "transparent",
        border: done ? "none" : "1px solid #3d4360",
        color: done ? "#0a0d14" : "transparent",
      }}>
        {done ? "✓" : ""}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 500,
        color: done ? "#64748b" : "#e2e8f0",
        textDecoration: done ? "line-through" : "none",
      }}>
        {label}
      </span>
    </div>
  );
}
