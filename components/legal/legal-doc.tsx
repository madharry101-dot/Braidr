import type { ReactNode } from "react";

// Shared shell + typography for /terms and /privacy. Content is faithful to
// the drafted documents (braidr-privacy-policy / braidr-terms-of-service),
// which are NOT yet solicitor-reviewed — hence DraftNotice.

export function DraftNotice() {
  return (
    <div className="bg-gold/10 mb-8 rounded border-l-4 border-gold px-4 py-3 text-sm text-plum">
      <p className="font-medium">Draft — pending legal review</p>
      <p className="mt-1 text-slate">
        This is an engineering-ready draft. It has not yet been reviewed by a qualified UK solicitor
        and may change before it becomes final.
      </p>
    </div>
  );
}

export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="text-slate">
      <h1 className="font-display text-3xl text-plum">{title}</h1>
      <p className="mt-2 text-sm text-slate">Last updated: {updated} · Braidr Ltd</p>
      <div className="mt-6">
        <DraftNotice />
      </div>
      <div className="flex flex-col gap-8 text-sm leading-relaxed">{children}</div>
    </article>
  );
}

export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-plum">
        {n}. {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-medium text-plum">{title}</h3>
      <div className="mt-1 flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function KeyList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col gap-2">
      {items.map(([term, desc], i) => (
        <div key={i} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
          <dt className="font-medium text-plum">{term}</dt>
          <dd>{desc}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return <p className="bg-teal/5 rounded border-l-4 border-teal px-3 py-2 text-plum">{children}</p>;
}
