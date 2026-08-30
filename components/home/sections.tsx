import { ArrowRight, Check, Leaf, Lock, Scissors, Search, Shield } from "lucide-react";
import { BrLinkButton } from "@/components/braidr-ui/button";
import { BrChip } from "@/components/braidr-ui/badge";
import { BrImage } from "@/components/braidr-ui/image";
import { BrSectionHead } from "@/components/braidr-ui/section";
import { FadeUp, ImageReveal, StaggerGroup } from "@/components/motion/reveal";
import { HOME_COPY, ROUTES } from "./copy";

/*
 * Homepage sections — approved Variant B "Statement", Phase 1 Step 4.
 *
 * These are server components. The only client boundaries on the page are
 * the nav (scroll state) and the scroll-reveal wrappers, so the whole
 * homepage is server-rendered as readable HTML before any JS arrives.
 */

const ICONS = { Search, Leaf, Lock, Shield } as const;

/* ══ HERO — full-width brand-deep, type only, one gold word ═══ */

/**
 * The entrance is CSS (.br-enter), not Framer Motion. Motion brief Rule 3:
 * the hero must be readable within 100ms and with JS disabled, so its
 * hidden state cannot depend on hydration. `animation-fill-mode: both`
 * holds it from the first paint and reduced-motion switches it off.
 */
function entrance(delaySeconds: number, offsetPx?: number): React.CSSProperties {
  return {
    ["--br-enter-delay" as string]: `${delaySeconds}s`,
    ...(offsetPx !== undefined ? { ["--br-enter-y" as string]: `${offsetPx}px` } : {}),
  };
}

export function Hero() {
  const { eyebrow, headline, sub, primaryCta, secondaryCta } = HOME_COPY.hero;
  return (
    <header style={{ background: "var(--brand-deep)", color: "var(--text-inverse)" }}>
      <div className="br-wrap" style={{ padding: "72px 20px 88px", maxWidth: 1000 }}>
        <span className="br-eyebrow br-eyebrow-dark br-enter br-enter-fade" style={entrance(0)}>
          {eyebrow}
        </span>
        <h1 className="br-h1 br-display br-enter mt-7" style={entrance(0.1, 24)}>
          {headline[0]}
          <span style={{ color: "var(--brand-gold)" }}>{headline[1]}</span>
          {headline[2]}
        </h1>
        <p
          className="br-lead br-enter mt-7"
          style={{ ...entrance(0.25, 20), color: "rgba(249,244,237,.75)", maxWidth: 640 }}
        >
          {sub}
        </p>
        <div className="br-enter mt-10 flex flex-wrap gap-3" style={entrance(0.4, 16)}>
          <BrLinkButton href={ROUTES.braiders} variant="gold">
            <Search size={18} aria-hidden="true" />
            {primaryCta}
          </BrLinkButton>
          <BrLinkButton href={ROUTES.registerBraider} variant="ghost-inv">
            {secondaryCta}
          </BrLinkButton>
        </div>
      </div>
    </header>
  );
}

/* ══ PROOF STRIP ═════════════════════════════════════════════ */

export function ProofStrip() {
  return (
    <div style={{ background: "var(--brand-rich)" }}>
      <div className="br-wrap" style={{ padding: 0 }}>
        <ul className="br-proof">
          {HOME_COPY.proof.map((statement) => (
            <li
              key={statement}
              className="inline-flex items-center gap-2 whitespace-nowrap px-1 py-2 text-sm font-medium"
              style={{ color: "rgba(249,244,237,.85)" }}
            >
              <Check
                size={15}
                aria-hidden="true"
                style={{ color: "var(--brand-gold)", flex: "none" }}
              />
              {statement}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ══ FOR CLIENTS — text left, editorial image right ══════════ */

export function ClientsSection() {
  const c = HOME_COPY.clients;
  return (
    <section className="br-sec">
      <div className="br-wrap">
        <div className="br-split">
          <div>
            <FadeUp>
              <BrSectionHead label={c.label} heading={c.heading} sub={c.sub} maxWidth={520} />
            </FadeUp>
            <StaggerGroup className="flex flex-col gap-7">
              {c.benefits.map((benefit) => {
                const Icon = ICONS[benefit.icon];
                return (
                  <div key={benefit.title} className="flex gap-4">
                    <span
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-full"
                      style={{ background: "var(--brand-sand)" }}
                    >
                      <Icon size={20} aria-hidden="true" style={{ color: "var(--gold-ink)" }} />
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold">{benefit.title}</h3>
                      <p
                        className="mt-2 text-base leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {benefit.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </StaggerGroup>
            <FadeUp>
              <BrLinkButton href={ROUTES.braiders} className="mt-9">
                <Search size={18} aria-hidden="true" />
                {HOME_COPY.hero.primaryCta}
              </BrLinkButton>
            </FadeUp>
          </div>
          <ImageReveal className="br-split-media">
            <BrImage ratio="3 / 4" radius="xl" note={c.imageNote} />
          </ImageReveal>
        </div>
      </div>
    </section>
  );
}

/* ══ BRAIDCARE — the warmest section on the page by design ════ */

export function BraidCareSection() {
  const b = HOME_COPY.braidcare;
  return (
    <section className="br-sec" style={{ background: "var(--brand-cream)" }}>
      <div className="br-wrap">
        <div className="br-split br-split-rev">
          <div>
            <FadeUp>
              <BrSectionHead label={b.label} heading={b.heading} maxWidth={560} className="mb-6" />
              <div className="flex flex-col gap-4">
                {b.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    className="text-[1.0625rem] leading-[1.7]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              {/* Mandatory closer — must accompany every BraidCare surface. */}
              <div
                className="mt-7 rounded-lg px-5 py-[18px]"
                style={{
                  background: "var(--brand-sand)",
                  borderLeft: "3px solid var(--brand-sage)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <p className="text-base font-medium leading-relaxed">{b.closer}</p>
              </div>
              <BrLinkButton href={ROUTES.braidcare} variant="ghost" className="mt-7">
                <Leaf size={18} aria-hidden="true" />
                {b.cta}
              </BrLinkButton>
            </FadeUp>
          </div>

          <ImageReveal className="br-split-media">
            <div className="grid gap-3.5">
              <BrImage ratio="16 / 9" note={b.imageNote} />
              <div className="br-card p-[18px]">
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="text-xs font-semibold uppercase tracking-[0.06em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {b.sessionsHeading}
                  </span>
                  <BrChip tone="price">{b.sessionsChip}</BrChip>
                </div>
                {b.sessions.map((session, index) => {
                  // Sage = done, gold = act now, sand = not yet open.
                  const tone = ["var(--brand-sage)", "var(--brand-gold)", "var(--brand-sand)"][
                    index
                  ];
                  const onTone =
                    index === 0
                      ? "var(--text-inverse)"
                      : index === 1
                        ? "var(--brand-deep)"
                        : "var(--text-primary)";
                  return (
                    <div
                      key={session.number}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderTop: "1px solid var(--brand-sand)" }}
                    >
                      <span
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[0.8125rem] font-semibold"
                        style={{ background: tone, color: onTone }}
                      >
                        {session.number}
                      </span>
                      <span className="flex-1 text-[0.9375rem]">{session.title}</span>
                      <span className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                        {session.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ImageReveal>
        </div>
      </div>
    </section>
  );
}

/* ══ DARK FEATURE SECTION ════════════════════════════════════ */

export function DarkSection() {
  const d = HOME_COPY.dark;
  return (
    <section className="br-sec" style={{ background: "var(--brand-deep)" }}>
      <div className="br-wrap">
        <FadeUp>
          <BrSectionHead
            label={d.label}
            heading={d.heading}
            sub={d.sub}
            dark
            align="center"
            maxWidth={720}
          />
        </FadeUp>
        <StaggerGroup className="br-cards3">
          {d.cards.map((card) => {
            const Icon = ICONS[card.icon];
            return (
              <div key={card.title} className="br-card br-card-dark h-full p-7">
                <Icon size={22} aria-hidden="true" style={{ color: "var(--brand-gold)" }} />
                <h3 className="mt-4 text-xl font-semibold">{card.title}</h3>
                <p
                  className="mt-2.5 text-[0.9375rem] leading-relaxed"
                  style={{ color: "rgba(249,244,237,.72)" }}
                >
                  {card.body}
                </p>
              </div>
            );
          })}
        </StaggerGroup>
        <FadeUp className="mt-12 text-center">
          <BrLinkButton href={ROUTES.braiders} variant="gold">
            {d.cta}
            <ArrowRight size={18} aria-hidden="true" />
          </BrLinkButton>
        </FadeUp>
      </div>
    </section>
  );
}

/* ══ FOR BRAIDERS — doorway, image left, text right ══════════ */

export function BraidersSection() {
  const b = HOME_COPY.braiders;
  return (
    <section className="br-sec" style={{ background: "var(--brand-sand)" }}>
      <div className="br-wrap">
        <div className="br-split br-split-rev">
          <FadeUp>
            <span className="br-eyebrow" style={{ borderColor: "rgba(28,17,8,.15)" }}>
              {b.label}
            </span>
            <h2 className="br-h2 br-display mt-5" style={{ fontSize: "2rem" }}>
              {b.heading}
            </h2>
            <p className="br-lead mt-4">{b.body}</p>
            <BrLinkButton href={ROUTES.registerBraider} variant="ghost" className="mt-7">
              <Scissors size={18} aria-hidden="true" />
              {b.cta}
            </BrLinkButton>
          </FadeUp>
          <ImageReveal className="br-split-media">
            <BrImage ratio="4 / 3" radius="xl" note={b.imageNote} />
          </ImageReveal>
        </div>
      </div>
    </section>
  );
}
