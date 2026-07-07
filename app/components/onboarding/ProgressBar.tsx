export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{
        width: `${percent}%`, height: "100%", borderRadius: 999,
        background: "linear-gradient(90deg,#1F4E5F,#4a9bb0)",
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}
