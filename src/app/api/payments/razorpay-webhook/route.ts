import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !supabaseUrl || !serviceKey) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "hex"); } catch { return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 }); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });

  const event = JSON.parse(rawBody) as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string } } };
  };
  if (event.event !== "payment.captured") return NextResponse.json({ received: true });
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id || payment.status !== "captured" || !payment.amount || payment.currency !== "INR") {
    return NextResponse.json({ error: "Captured payment details are incomplete." }, { status: 400 });
  }

  const admin = createSupabaseClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: pendingPayment, error: lookupError } = await admin.from("payments").select("id, amount_paise, status")
    .eq("method", "razorpay").eq("external_reference", payment.order_id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!pendingPayment) return NextResponse.json({ received: true, ignored: true });
  if (pendingPayment.status === "completed") return NextResponse.json({ received: true, alreadyCompleted: true });
  if (pendingPayment.amount_paise !== payment.amount) return NextResponse.json({ error: "Captured amount does not match the invoice payment." }, { status: 409 });

  const { error } = await admin.rpc("complete_online_invoice_payment", {
    target_order_id: payment.order_id,
    target_gateway_payment_id: payment.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ received: true, completed: true });
}
