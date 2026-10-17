export function PageHeading({ eyebrow, title, description, actions }) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function Panel({ title, description, children, className = '' }) {
  return <section className={`workspace-panel ${className}`}><header className="panel-heading"><h2>{title}</h2>{description && <p>{description}</p>}</header>{children}</section>;
}

export function DataTable({ caption, columns, rows, emptyMessage }) {
  return <div className="table-scroll"><table className="data-table"><caption className="visually-hidden">{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>) : <tr><td colSpan={columns.length}>{emptyMessage}</td></tr>}</tbody></table></div>;
}
import { CircleAlert, CircleCheck, Info, LoaderCircle } from 'lucide-react';

export function Feedback({ tone = 'info', children, action }) {
  const Icon = tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : Info;
  return <div className={`feedback feedback-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={18} aria-hidden="true" /><div>{children}</div>{action && <div className="feedback-action">{action}</div>}</div>;
}

export function LoadingState({ label = 'Loading…' }) {
  return <div className="loading-state" role="status"><LoaderCircle size={20} className="loading-indicator" aria-hidden="true" /><span>{label}</span></div>;
}

export function EmptyState({ title, description, action, className = '' }) {
  return <div className={`empty-state ${className}`}><h3>{title}</h3><p>{description}</p>{action && <div className="empty-state-action">{action}</div>}</div>;
}
