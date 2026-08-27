"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import { ServiceForm } from "@/components/braider/service-form";
import {
  useCreateService,
  useUpdateService,
  useDeleteService,
} from "@/lib/hooks/braider-dashboard";
import { formatMoney, formatDuration } from "@/lib/format";
import type { Service } from "@/lib/types/braidmatch";

function ServicesManager({ braiderId, services }: { braiderId: string; services: Service[] }) {
  const create = useCreateService(braiderId);
  const update = useUpdateService(braiderId);
  const remove = useDeleteService(braiderId);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Services"
        subtitle="What clients can book. Each service has a price and a duration."
        action={
          !adding ? (
            <Button size="sm" className="sm:!w-auto" onClick={() => setAdding(true)}>
              Add a service
            </Button>
          ) : undefined
        }
      />

      {adding && (
        <Card>
          <h2 className="mb-4 font-display text-lg text-plum">New service</h2>
          <ServiceForm
            submitLabel="Add service"
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              await create.mutateAsync(input);
              setAdding(false);
            }}
          />
        </Card>
      )}

      {services.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No services yet</p>
          <p className="mt-1 text-sm text-slate">Add your first service so clients can book you.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {services.map((s) =>
          editingId === s.id ? (
            <Card key={s.id}>
              <h2 className="mb-4 font-display text-lg text-plum">Edit service</h2>
              <ServiceForm
                initial={s}
                submitLabel="Save changes"
                onCancel={() => setEditingId(null)}
                onSubmit={async (input) => {
                  await update.mutateAsync({ sid: s.id, ...input });
                  setEditingId(null);
                }}
              />
            </Card>
          ) : (
            <Card
              key={s.id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-plum">{s.name}</h3>
                  <Badge>{s.category}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate">
                  {formatDuration(s.duration_mins)} · from {formatMoney(s.price_from)}
                  {s.price_to ? ` – ${formatMoney(s.price_to)}` : ""}
                </p>
                {s.description && <p className="mt-1 text-sm text-slate">{s.description}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="sm:!w-auto"
                  onClick={() => setEditingId(s.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:!w-auto"
                  loading={remove.isPending && remove.variables === s.id}
                  onClick={() => {
                    if (window.confirm(`Remove "${s.name}"? Clients won't be able to book it.`)) {
                      remove.mutate(s.id);
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

export default function BraiderServicesPage() {
  return (
    <RequireBraiderProfile>
      {(me) => <ServicesManager braiderId={me.profile.id} services={me.services} />}
    </RequireBraiderProfile>
  );
}
