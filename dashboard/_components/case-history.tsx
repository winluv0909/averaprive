type AuditEvent = { id: number; action: string; actor_user_id: string | null; metadata: Record<string, unknown> | null; created_at: string };

export function CaseHistory({ events, openedAt, openedLabel }: { events: AuditEvent[]; openedAt: string; openedLabel: string }) {
  const items = [{ id: -1, action: openedLabel, actor_user_id: null, metadata: null, created_at: openedAt }, ...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return <section className="case-history"><div className="case-history-head"><p>TRACEABLE RECORD</p><h2>Case history</h2><span>{items.length} recorded event{items.length === 1 ? "" : "s"}</span></div><ol>{items.map((event) => <li key={event.id}><i /><time>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(event.created_at))}</time><div><b>{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</b><small>{event.actor_user_id ? `Actor ${event.actor_user_id.slice(0, 8).toUpperCase()}` : "Case origin"}</small>{event.metadata && Object.keys(event.metadata).length > 0 && <pre>{JSON.stringify(event.metadata)}</pre>}</div></li>)}</ol></section>;
}
