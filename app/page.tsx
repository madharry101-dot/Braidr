import { BrPublicNav } from "@/components/braidr-ui/nav";
import { MarketingFooter } from "@/components/home/marketing-footer";
import {
  BraidCareSection,
  BraidersSection,
  ClientsSection,
  DarkSection,
  Hero,
  ProofStrip,
} from "@/components/home/sections";

/*
 * Braidr homepage — approved design, Variant B "Statement" (Phase 1, Step 4).
 *
 * The nav pill sits on the dark hero and is the page's only always-client
 * component (it tracks scroll position). Everything else is server-rendered,
 * so the full copy is in the initial HTML for crawlers and for anyone whose
 * JS has not arrived yet.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Not wrapped in anything — the nav's sticky positioning needs the
          page's scroll container as its containing block. */}
      <BrPublicNav />
      <main className="flex-1">
        <Hero />
        <ProofStrip />
        <ClientsSection />
        <BraidCareSection />
        <DarkSection />
        <BraidersSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
