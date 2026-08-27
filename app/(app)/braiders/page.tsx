"use client";

import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export default function BraiderSearchPage() {
  return (
    <div>
      <PageHeader title="Find a braider" subtitle="Verified braiders near you." />
      <ComingSoon note="Search, filters and braider cards call /api/braiders and /api/braiders/style-match. This is the first screen of the next sprint — the BraidMatch booking flow." />
    </div>
  );
}
