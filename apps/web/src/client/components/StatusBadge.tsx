type StatusBadgeProps = {
  value: string;
};

function toneForStatus(value: string): string {
  const normalized = value.toLowerCase();
  if (["completed", "approved", "partnered", "signed", "active", "positive", "meeting", "sent", "delivered"].some((item) => normalized.includes(item))) {
    return "success";
  }
  if (["queued", "draft", "aligned", "question", "follow_up_needed", "contacted", "shortlisted", "escalated"].some((item) => normalized.includes(item))) {
    return "warning";
  }
  if (["failed", "rejected", "declined", "disabled", "error"].some((item) => normalized.includes(item))) {
    return "danger";
  }
  return "neutral";
}

export function StatusBadge({ value }: StatusBadgeProps) {
  return <span className={`badge badge-${toneForStatus(value)}`}>{value}</span>;
}
