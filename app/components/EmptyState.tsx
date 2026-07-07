interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export default function EmptyState({
  icon, title, description, actionLabel, onAction, compact = false,
}: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding: compact ? "48px 24px" : "72px 24px" }}>
      <style>{`.es-action-btn:hover { filter: brightness(1.1); }`}</style>
      <div style={{
        width: compact ? 48 : 64, height: compact ? 48 : 64, borderRadius: "50%",
        background: "rgba(74,155,176,0.1)", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: compact ? 22 : 28, margin: "0 auto 18px",
      }}>
        {icon}
      </div>
      <div style={{ fontSize: compact ? 14 : 17, fontWeight: 700, color: "#f1f5f9" }}>
        {title}
      </div>
      {description && (
        <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, maxWidth: 360, margin: "8px auto 0" }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          className="es-action-btn"
          onClick={onAction}
          style={{
            marginTop: 24, display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#1F4E5F,#0d3547)", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "filter 0.15s",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
