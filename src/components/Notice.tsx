type NoticeVariant = "info" | "warning" | "error" | "success";

interface NoticeProps {
  children: React.ReactNode;
  variant?: NoticeVariant;
}

const styles: Record<NoticeVariant, string> = {
  info: "border-surface-3 bg-surface-2 text-text-secondary",
  warning: "border-accent/40 bg-accent/10 text-accent",
  error: "border-error/40 bg-error/10 text-error",
  success: "border-success/40 bg-success/10 text-success",
};

export function Notice({ children, variant = "info" }: NoticeProps) {
  return <div className={`rounded border px-4 py-3 text-sm ${styles[variant]}`}>{children}</div>;
}
