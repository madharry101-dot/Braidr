export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl text-plum sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Honest stub for screens whose UI lands in a later sprint. The backend
// route it will call already exists.
export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-mist bg-white/60 p-8 text-center">
      <p className="font-medium text-plum">Screen under construction</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate">{note}</p>
    </div>
  );
}
