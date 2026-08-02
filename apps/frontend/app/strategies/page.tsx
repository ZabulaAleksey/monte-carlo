import { Construction } from "lucide-react";

import { PageHeader } from "@/components/page-header";

export default function StrategiesPage(): React.JSX.Element {
  return (
    <>
      <PageHeader eyebrow="Research workspace" title="Strategies" description="Strategy research will be introduced in a dedicated future stage." />
      <section className="empty-state panel"><div className="empty-icon"><Construction size={28} /></div><h2>Intentionally not implemented</h2><p>This foundation does not include strategies, backtesting, Monte Carlo analysis or genetic optimization.</p></section>
    </>
  );
}
