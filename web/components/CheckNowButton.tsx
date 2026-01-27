"use client";

import { useState } from "react";
import { checkOrder } from "../lib/api";

export default function CheckNowButton({
  id,
  token,
  userId,
}: {
  id?: string;
  token: string;
  userId: string;
}) {
  const [loading, setLoading] = useState(false);

  if (!id) return null;

  const onClick = async () => {
    setLoading(true);
    try {
      await checkOrder(token, userId, id);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Check failed. Open DevTools Console to see the error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onClick} disabled={loading}>
      {loading ? "Checking..." : "Check now"}
    </button>
  );
}
