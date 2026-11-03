import { createFileRoute } from "@tanstack/react-router";

// Razorpay webhook. Configure in Razorpay Dashboard → Webhooks with events:
// payment.captured, payment.failed, refund.processed.
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Too large", { status: 413 });
        const { verifyWebhookSignature } = await import("@/lib/razorpay.server");
        if (!(await verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), secret)))
          return new Response("Invalid signature", { status: 401 });

        let body: { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; currency: string; status: string; error_description?: string } }; refund?: { entity?: { payment_id: string } } } };
        try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
        const event = String(body.event ?? "");
        const eventId = request.headers.get("x-razorpay-event-id");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (eventId) {
          const { error: dup } = await supabaseAdmin.from("payment_webhook_events").insert({ event_id: eventId.slice(0, 100), event: event.slice(0, 60) });
          if (dup) return new Response("Duplicate", { status: 200 });
        }

        const pay = body.payload?.payment?.entity;
        if (event === "payment.captured" && pay) {
          const { data: row } = await supabaseAdmin.from("payments").select("amount_paise, currency").eq("razorpay_order_id", pay.order_id).maybeSingle();
          if (row && row.amount_paise === pay.amount && row.currency === pay.currency && pay.status === "captured")
            await supabaseAdmin.rpc("apply_verified_payment", { _order_id: pay.order_id, _payment_id: pay.id, _via: "webhook" });
        } else if (event === "payment.failed" && pay) {
          // Only marks orders that never succeeded; out-of-order events can't undo a payment.
          await supabaseAdmin.from("payments").update({ status: "failed", failure_reason: (pay.error_description ?? "Payment failed").slice(0, 200), updated_at: new Date().toISOString() })
            .eq("razorpay_order_id", pay.order_id).eq("status", "created");
        } else if (event === "refund.processed") {
          const pid = body.payload?.refund?.entity?.payment_id;
          if (pid) await supabaseAdmin.rpc("revoke_refunded_payment", { _payment_id: pid });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
