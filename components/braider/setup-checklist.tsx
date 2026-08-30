import Link from "next/link";
import type { BraiderMe } from "@/lib/types/braidmatch";

type Step = { label: string; done: boolean; href: string; cta: string };

export function buildSteps(me: BraiderMe): Step[] {
  const p = me.profile;
  return [
    {
      label: "Complete your profile",
      done: Boolean(p && p.bio && p.specialisations.length > 0),
      href: "/dashboard/braider/profile",
      cta: "Edit profile",
    },
    {
      // Part 1 — the texture specialisations step. "Done" means at least
      // one is actually verified (has a tagged portfolio photo), not just
      // declared — an unverified specialisation is invisible to clients, so
      // declaring one on its own isn't real progress.
      label: "Choose the textures you specialise in",
      done: Boolean(p && p.texture_specialisations.some((s) => s.is_verified)),
      href: "/dashboard/braider/profile",
      cta: "Choose textures",
    },
    {
      label: "Add at least one service",
      done: me.services.length > 0,
      href: "/dashboard/braider/services",
      cta: "Add a service",
    },
    {
      label: "Set your weekly hours",
      done: me.availability_rules.length > 0,
      href: "/dashboard/braider/availability",
      cta: "Set hours",
    },
    {
      label: "Connect payouts with Stripe",
      done: Boolean(p?.stripe_charges_enabled),
      href: "/dashboard/braider/payments",
      cta: "Connect Stripe",
    },
  ];
}

export function SetupChecklist({ me }: { me: BraiderMe }) {
  const steps = buildSteps(me);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <div className="rounded-lg border border-mist bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-plum">Get set up to take bookings</h2>
        <span className="text-sm text-slate">
          {done}/{steps.length} done
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist">
        <div
          className="h-full rounded-full bg-teal transition-all"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ul className="mt-4 flex flex-col divide-y divide-mist">
        {steps.map((s) => (
          <li key={s.href} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs " +
                  (s.done ? "bg-success text-white" : "border border-mist text-transparent")
                }
              >
                ✓
              </span>
              <span className={s.done ? "text-slate line-through" : "text-plum"}>{s.label}</span>
            </span>
            {!s.done && (
              <Link
                href={s.href}
                className="shrink-0 text-sm font-medium text-teal-deep hover:text-plum"
              >
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
