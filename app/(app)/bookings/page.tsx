"use client";

import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export default function BookingsPage() {
  return (
    <div>
      <PageHeader title="Your bookings" subtitle="Upcoming and past appointments." />
      <ComingSoon note="Booking list and detail views are backed by /api/bookings. Screens land with the BraidMatch sprint." />
    </div>
  );
}
