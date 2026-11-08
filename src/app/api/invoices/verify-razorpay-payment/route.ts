import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret || !supabaseUrl || !serviceKey) return NextResponse.json({ error: "Online payment verification is not configured." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { data: student } = await supabase.from("students").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!student) return NextResponse.json({ error: "Resident account not found." }, { status: 403 });

  const body = await request.json().catch(() => null) as { invoiceId?: string; orderId?: string; razorpayPaymentId?: string; signature?: string } | null;
  if (!body?.invoiceId || !body.orderId || !body.razorpayPaymentId || !body.signature) return NextResponse.json({ error: "Payment verification details are incomplete." }, { status: 400 });

  const expected = createHmac("sha256", keySecret).update(`${body.orderId}|${body.razorpayPaymentId}`).digest();
  let received: Buffer;
  try { received = Buffer.from(body.signature, "hex"); } catch { return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 }); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });

  const { data: payment, error: paymentError } = await supabase.from("payments").select("id, amount_paise, status")
    .eq("student_id", student.id).eq("invoice_id", body.invoiceId).eq("external_reference", body.orderId).eq("method", "razorpay").maybeSingle();
  if (paymentError || !payment) return NextResponse.json({ error: "The payment order does not belong to this resident or invoice." }, { status: 404 });
  if (payment.status === "completed") return NextResponse.json({ verified: true, alreadyCompleted: true });

  const gatewayResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(body.razorpayPaymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
    cache: "no-store",
  });
  const gatewayPayment = await gatewayResponse.json().catch(() => null) as { order_id?: string; amount?: number; currency?: string; status?: string } | null;
  if (!gatewayResponse.ok || gatewayPayment?.order_id !== body.orderId || gatewayPayment.amount !== payment.amount_paise || gatewayPayment.currency !== "INR" || gatewayPayment.status !== "captured") {
    return NextResponse.json({ error: "The payment has not been captured or does not match this invoice. If money was deducted, contact your PG owner." }, { status: 409 });
  }

  const admin = createSupabaseClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: completionError } = await admin.rpc("complete_online_invoice_payment", {
    target_order_id: body.orderId,
    target_gateway_payment_id: body.razorpayPaymentId,
  });
  if (completionError) return NextResponse.json({ error: completionError.message }, { status: 409 });
  return NextResponse.json({ verified: true });
}
