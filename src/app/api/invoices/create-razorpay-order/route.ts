import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return NextResponse.json({ error: "Online payments are not configured. You can request cash payment confirmation from your PG owner." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to pay this invoice." }, { status: 401 });
  const { data: student } = await supabase.from("students").select("id, owner_id, full_name, email, phone").eq("auth_user_id", user.id).maybeSingle();
  if (!student) return NextResponse.json({ error: "Resident account not found." }, { status: 403 });

  const body = await request.json().catch(() => null) as { invoiceId?: string } | null;
  if (!body?.invoiceId) return NextResponse.json({ error: "Invoice ID is required." }, { status: 400 });
  const { data: invoice, error: invoiceError } = await supabase.from("invoices")
    .select("id, invoice_number, owner_id, student_id, total_paise, amount_paid_paise, status")
    .eq("id", body.invoiceId).eq("student_id", student.id).maybeSingle();
  if (invoiceError || !invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (invoice.owner_id !== student.owner_id || ["paid", "cancelled"].includes(invoice.status)) return NextResponse.json({ error: "This invoice cannot accept payment." }, { status: 409 });
  const amount = invoice.total_paise - invoice.amount_paid_paise;
  if (amount <= 0) return NextResponse.json({ error: "This invoice has no remaining balance." }, { status: 409 });

  const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt: invoice.invoice_number.slice(0, 40), notes: { invoice_id: invoice.id, student_id: student.id } }),
    cache: "no-store",
  });
  const order = await response.json().catch(() => null) as { id?: string; amount?: number; currency?: string; error?: { description?: string } } | null;
  if (!response.ok || !order?.id) return NextResponse.json({ error: order?.error?.description ?? "Could not start online payment." }, { status: 502 });

  const { data: paymentId, error: paymentError } = await supabase.rpc("resident_create_online_invoice_payment", {
    target_invoice_id: invoice.id,
    target_order_id: order.id,
  });
  if (paymentError || !paymentId) return NextResponse.json({ error: paymentError?.message ?? "Could not register the payment order." }, { status: 409 });

  return NextResponse.json({
    orderId: order.id,
    paymentId,
    keyId,
    amount: order.amount ?? amount,
    currency: order.currency ?? "INR",
    invoiceNumber: invoice.invoice_number,
    student: { name: student.full_name, email: student.email ?? user.email ?? "", phone: student.phone },
  });
}
