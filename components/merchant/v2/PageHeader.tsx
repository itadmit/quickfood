import type { ReactNode } from "react";

export function PageHeader({
  chip,
  title,
  subtitle,
  actions,
}: {
  chip?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="relative rounded-3xl overflow-hidden border-2 border-black shadow-[0_3px_0_#000] p-5 lg:p-7" style={{ backgroundColor: "#F8CB1E" }}>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          {(chip || subtitle) && (
            <div className="inline-flex items-center gap-2 mb-2.5 text-black/70 text-xs font-semibold flex-wrap">
              {chip && (
                <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
                  {chip}
                </span>
              )}
              {subtitle && <span>{subtitle}</span>}
            </div>
          )}
          <h1 className="text-black font-black text-3xl lg:text-4xl leading-[1.1]">
            {title}
          </h1>
        </div>
        {actions && (
          <div className="flex gap-2 flex-wrap items-center self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
