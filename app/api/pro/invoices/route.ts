import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptUtr, maskUtr } from "@/lib/crypto/utr";
import { generateInvoicePdf } from "@/lib/pro/invoice-pdf";
import { fail } from "@/lib/api/response";

// POST /api/pro/invoices — not in the TRD's endpoint table (only described
// qualitatively under Step 4: "invoice generator built into platform (PDF
// download)"); returns the PDF directly rather than the JSON envelope,
// since this is a file download. Body: { booking_id }.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const body = await request.json().catch(() => null);
  const bookingId = body?.booking_id;
  if (typeof bookingId !== "string") {
    return fail("VALIDATION_ERROR", "booking_id is required.", 422, "booking_id");
  }

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id, user_id")
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile) return fail("ROLE_MISMATCH", "Only braiders can generate invoices.", 403);

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, service_id, appointment_at, amount_pence, status")
    .eq("id", bookingId)
    .eq("braider_id", braiderProfile.id)
    .single();
  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (booking.status !== "completed") {
    return fail("VALIDATION_ERROR", "Invoices can only be generated for completed bookings.", 422);
  }

  const [
    { data: clientProfile },
    { data: braiderOwnProfile },
    { data: service },
    { data: proProgress },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", booking.client_id)
      .single(),
    supabase.from("profiles").select("full_name, display_name").eq("id", user.id).single(),
    supabase.from("services").select("name").eq("id", booking.service_id).single(),
    supabase
      .from("braidr_pro_progress")
      .select("step2_utr")
      .eq("braider_id", braiderProfile.id)
      .single(),
  ]);

  const pdf = await generateInvoicePdf({
    invoiceNumber: booking.id.slice(0, 8).toUpperCase(),
    braiderName:
      braiderOwnProfile?.display_name ?? braiderOwnProfile?.full_name ?? "Braidr Braider",
    clientName: clientProfile?.display_name ?? clientProfile?.full_name ?? "Client",
    serviceName: service?.name ?? "Service",
    appointmentDate: new Date(booking.appointment_at).toLocaleDateString("en-GB"),
    amountPence: booking.amount_pence,
    utrMasked: proProgress?.step2_utr ? maskUtr(decryptUtr(proProgress.step2_utr)) : null,
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${booking.id.slice(0, 8)}.pdf"`,
    },
  });
}
