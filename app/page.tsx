import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { SiteFooter } from "@/components/brand/site-footer";

const LAYERS = [
  {
    name: "BraidMatch",
    tag: "Book",
    body: "Find verified braiders near you, compare styles and prices, and book with payment held securely until 24 hours after your appointment.",
  },
  {
    name: "BraidCare",
    tag: "Monitor",
    body: "Observational scalp health monitoring between appointments — three guided photo sessions per booking. Not a diagnosis; a way to catch tension early.",
  },
  {
    name: "Braidr Pro",
    tag: "Grow",
    body: "A five-step pathway to running braiding as a proper business: readiness, HMRC registration, insurance, banking, and ongoing growth.",
  },
  {
    name: "Expert Network",
    tag: "Refer",
    body: "When something needs a specialist, braiders and clients can be referred to partner dermatologists — at no cost in either direction.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-4 lg:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="min-h-[44px] rounded px-3 py-2 text-sm font-medium text-slate hover:text-plum"
          >
            Sign in
          </Link>
          <LinkButton href="/register" size="sm" className="!w-auto">
            Get started
          </LinkButton>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-content px-4 pb-14 pt-10 lg:px-8 lg:pt-20">
          <p className="font-medium uppercase tracking-widest text-gold-deep">
            For the UK hair braiding industry
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-plum sm:text-5xl lg:text-6xl">
            Book a braider. Protect your scalp. Build a business.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate">
            Braidr is one account for clients and braiders — booking and payments, scalp health
            monitoring, and the tools to turn braiding into professional, tax-registered work.
          </p>
          <div className="mt-8 flex flex-col gap-3 xs:flex-row">
            <LinkButton href="/register" size="lg" className="xs:!w-auto">
              Create your account
            </LinkButton>
            <LinkButton href="/braiders" size="lg" variant="secondary" className="xs:!w-auto">
              Browse braiders
            </LinkButton>
          </div>
        </section>

        {/* Four layers */}
        <section className="border-t border-mist bg-white">
          <div className="mx-auto max-w-content px-4 py-14 lg:px-8">
            <h2 className="font-display text-2xl text-plum sm:text-3xl">
              One platform, four layers
            </h2>
            <p className="mt-2 max-w-2xl text-slate">
              Each layer is proven before the next launches.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {LAYERS.map((l) => (
                <div key={l.name} className="rounded-lg border border-mist bg-cream p-6">
                  <span className="inline-block rounded-full bg-plum px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                    {l.tag}
                  </span>
                  <h3 className="mt-3 font-display text-xl text-plum">{l.name}</h3>
                  <p className="mt-2 text-sm text-slate">{l.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reassurance */}
        <section className="mx-auto max-w-content px-4 py-14 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="font-medium text-plum">Payments held safely</h3>
              <p className="mt-1 text-sm text-slate">
                Your payment is released to the braider 24 hours after the appointment, not before.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-plum">Verified braiders</h3>
              <p className="mt-1 text-sm text-slate">
                Braiders complete profile, service and location checks before they appear in search.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-plum">Health, not hype</h3>
              <p className="mt-1 text-sm text-slate">
                BraidCare uses observational language only and refers you to a specialist when
                needed.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
