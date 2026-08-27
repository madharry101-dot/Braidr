"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";

export default function AdminOverview() {
  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Moderation, verification, disputes and platform reporting."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["Verification queue", "Open disputes", "Users", "Content moderation"].map((t) => (
          <Card key={t}>
            <CardTitle className="text-base">{t}</CardTitle>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <ComingSoon note="Admin screens are backed by /api/admin/*. Middleware already blocks non-admins server-side. Interactive tables land in the Admin sprint." />
      </div>
    </div>
  );
}
