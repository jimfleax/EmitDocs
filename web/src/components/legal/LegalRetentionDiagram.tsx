import { Clock, ShieldSlash, Trash, ChartBar } from "@phosphor-icons/react";

export function LegalRetentionDiagram() {
  const steps = [
    {
      step: "01",
      title: "Batch Completion",
      desc: "Issuance job reaches terminal state (completed/canceled). Organizers choose retention: 24h, 7d (default), or 30d max.",
      icon: Clock,
      color: "bg-blue-50 text-blue-600 border-blue-200/80",
    },
    {
      step: "02",
      title: "Logical Expiry",
      desc: "At exact deadline timestamp, download URLs are instantly blocked and recipient PII is masked from UI views.",
      icon: ShieldSlash,
      color: "bg-amber-50 text-amber-600 border-amber-200/80",
    },
    {
      step: "03",
      title: "Physical Deletion Sweep",
      desc: "Automated cleanup sweep permanently purges Cloudflare R2 files and MongoDB recipient rows from storage.",
      icon: Trash,
      color: "bg-rose-50 text-rose-600 border-rose-200/80",
    },
    {
      step: "04",
      title: "Aggregate Stats Only",
      desc: "Only non-identifying counts (e.g. 500 documents issued) remain for historical usage quotas. Zero PII persists.",
      icon: ChartBar,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200/80",
    },
  ];

  return (
    <div className="my-6 p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60">
        <div>
          <h4 className="text-sm font-bold text-slate-900 tracking-tight">
            Data Retention &amp; Automated Deletion Lifecycle (PRD-CORE-09)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic lifecycle guarantees for uploaded spreadsheets and
            compiled documents
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700 font-medium">
          Zero Permanent PII
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="p-4 rounded-xl bg-white border border-slate-200/70 flex flex-col justify-between shadow-xs hover:border-blue-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {item.step}
                  </span>
                  <div className={`p-1.5 rounded-lg border ${item.color}`}>
                    <Icon size={16} weight="duotone" />
                  </div>
                </div>
                <h5 className="font-semibold text-xs text-slate-900 mb-1">
                  {item.title}
                </h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
