"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

export type OperationsRecord = {
  id: string;
  name: string;
  summary: string;
  status: string;
  date?: string | null;
  href: string;
  action: string;
};

export function OperationsRecords({ records, title, emptyTitle, emptyDescription }: {
  records: OperationsRecord[];
  title: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const searchId = useId();
  const statusId = useId();
  const statuses = [...new Set(records.map(record => record.status))];
  const visible = useMemo(() => records.filter(record =>
    (status === "all" || record.status === status) &&
    [record.name, record.summary, record.id].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ), [records, search, status]);
  return <section className="owner-records" aria-label={title}>
    <header className="owner-records-toolbar">
      <div><h2>{title}</h2><p aria-live="polite">{visible.length} of {records.length} records</p></div>
      <div className="owner-records-controls">
        <label htmlFor={searchId}>Search records<input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Agency, reference or content" /></label>
        <label htmlFor={statusId}>Status<select id={statusId} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      </div>
    </header>
    {visible.length ? <div className="owner-records-scroll"><table>
      <thead><tr><th scope="col">Agency / record</th><th scope="col">Information</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col">Action</th></tr></thead>
      <tbody>{visible.map(record => <tr key={record.id}>
        <td><b>{record.name}</b><small>Reference {record.id.slice(0,8)}</small></td>
        <td><p className="owner-record-summary">{record.summary}</p></td>
        <td><span className="owner-record-status">{record.status.replaceAll("_", " ")}</span></td>
        <td>{record.date && Number.isFinite(Date.parse(record.date)) ? new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeZone:"Asia/Manila"}).format(new Date(record.date)) : "Not provided"}</td>
        <td><Link href={record.href}>{record.action}<span aria-hidden="true"> →</span></Link></td>
      </tr>)}</tbody>
    </table></div> : <div className="owner-records-empty"><span aria-hidden="true">✓</span><h3>{records.length ? "No matching records" : emptyTitle}</h3><p>{records.length ? "Try another search or status filter." : emptyDescription}</p>{records.length > 0 && <button type="button" onClick={() => { setSearch("");setStatus("all"); }}>Clear filters</button>}</div>}
  </section>;
}
