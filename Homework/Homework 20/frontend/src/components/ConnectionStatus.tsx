interface ConnectionStatusProps {
  status: "idle" | "connecting" | "connected" | "disconnected";
}

const CONFIG = {
  idle: { label: "offline", dot: "bg-term-muted" },
  connecting: { label: "connecting...", dot: "bg-term-amber animate-pulse" },
  connected: { label: "live", dot: "bg-term-green animate-pulse" },
  disconnected: { label: "reconnecting...", dot: "bg-term-red animate-pulse" },
} as const;

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { label, dot } = CONFIG[status];
  return (
    <div className="flex items-center gap-2 text-xs text-term-muted">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
