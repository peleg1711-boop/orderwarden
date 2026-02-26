"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "../../lib/api";

export default function NewOrderForm({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createOrder(token, userId, {
        orderId,
        trackingNumber,
        carrier: carrier || undefined,
      });

      router.push("/orders");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 500 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <input
          placeholder="Order ID"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          required
        />

        <input
          placeholder="Tracking Number"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          required
        />

        <input
          placeholder="Carrier (optional)"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        />

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Order"}
        </button>
      </div>
    </form>
  );
}
