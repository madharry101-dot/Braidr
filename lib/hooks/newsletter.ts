"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { NewsletterConsentSource } from "@/types/database";

export type NewsletterState = {
  subscribed: boolean;
  subscribed_at: string | null;
  consent_source: NewsletterConsentSource | null;
};

export function useNewsletter() {
  return useQuery({
    queryKey: ["newsletter"],
    queryFn: () => api.get<NewsletterState>("/newsletter/subscribe"),
  });
}

export function useUpdateNewsletter(consentSource: NewsletterConsentSource = "settings_page") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscribed: boolean) =>
      api.put<{ subscribed: boolean }>("/newsletter/subscribe", {
        subscribed,
        consent_source: consentSource,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["newsletter"] }),
  });
}
