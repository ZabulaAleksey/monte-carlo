import { Database, Radio, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { API_URL } from "@/lib/api/client";

export default function SettingsPage(): React.JSX.Element {
  return (
    <>
      <PageHeader eyebrow="Platform configuration" title="Settings" description="Review the non-secret runtime configuration visible to the browser." />
      <section className="settings-grid">
        <article className="panel setting-card"><Radio size={20} /><div><span>Backend endpoint</span><strong className="mono">{API_URL}</strong><small>Configured with NEXT_PUBLIC_API_URL</small></div></article>
        <article className="panel setting-card"><Database size={20} /><div><span>Data mode</span><strong>PostgreSQL + demo seed</strong><small>Durable relational storage</small></div></article>
        <article className="panel setting-card"><ShieldCheck size={20} /><div><span>Credentials</span><strong>Environment only</strong><small>No secrets are embedded in the frontend</small></div></article>
      </section>
    </>
  );
}
