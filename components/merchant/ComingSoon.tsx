export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-qf-mute">{subtitle}</p>
      </header>
      <div className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash p-12 text-center text-qf-mute">
        <div className="text-base font-medium text-qf-ink2">בקרוב</div>
        <div className="text-xs mt-1">פיצ&apos;ר זה ייכנס בגרסת v1.0</div>
      </div>
    </div>
  );
}
