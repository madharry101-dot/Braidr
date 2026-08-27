"use client";

import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export default function BraidCarePage() {
  return (
    <div>
      <PageHeader
        title="BraidCare"
        subtitle="Observational scalp health monitoring — not a medical diagnosis."
      />
      <ComingSoon note="Session list, photo-capture guidance and reports are backed by /api/braidcare/sessions. Access opens 24h before a paid appointment (3 sessions per booking). Screens land in the BraidCare sprint." />
    </div>
  );
}
