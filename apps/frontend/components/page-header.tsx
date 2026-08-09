interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {badge ? (
        <div className="live-pill">
          <span className="status-dot" /> {badge}
        </div>
      ) : null}
    </header>
  );
}
