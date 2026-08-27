"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AssessmentAnswers, IncomeResponse, ProProgressResponse } from "@/lib/types/pro";

const PROGRESS_KEY = ["pro", "progress"];

export function useProProgress() {
  return useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => api.get<ProProgressResponse>("/pro/progress"),
  });
}

function useInvalidateProgress() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PROGRESS_KEY });
}

export function useSubmitAssessment() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: (answers: AssessmentAnswers) => api.post("/pro/assessment", answers),
    onSuccess: invalidate,
  });
}

export function useCompleteProStep() {
  const invalidate = useInvalidateProgress();
  return useMutation({
    mutationFn: async (
      args: { step: 2; utr: string } | { step: 3; file: File } | { step: 4 | 5 }
    ) => {
      if (args.step === 2) {
        return api.put(`/pro/steps/2`, { utr: args.utr });
      }
      if (args.step === 3) {
        const form = new FormData();
        form.append("document", args.file);
        const res = await fetch(`/api/pro/steps/3`, { method: "PUT", body: form });
        const payload = await res.json();
        if (!payload.success) {
          const err = payload.error;
          const e = new Error(err?.message ?? "Upload failed");
          (e as { field?: string }).field = err?.field;
          throw e;
        }
        return payload.data;
      }
      return api.put(`/pro/steps/${args.step}`);
    },
    onSuccess: invalidate,
  });
}

export function useProSubscribe() {
  return useMutation({
    mutationFn: () => api.post<{ checkout_url: string }>("/pro/subscribe"),
  });
}

export function useProIncome() {
  return useQuery({
    queryKey: ["pro", "income"],
    queryFn: () => api.get<IncomeResponse>("/pro/income"),
  });
}
