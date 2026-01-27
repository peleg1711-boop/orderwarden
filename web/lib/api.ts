import { OrderSummary } from "./types";

const getApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  return baseUrl.replace(/\/$/, "");
};

const request = async <T>(
  path: string,
  token: string,
  userId?: string,
  options?: RequestInit
): Promise<T> => {
  const url = `${getApiBaseUrl()}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(userId ? { "x-clerk-user-id": userId } : {}),
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }

  return res.json();
};

const mapOrder = (order: Record<string, any>): OrderSummary => {
  return {
    id: typeof order.id === "string" ? order.id : undefined,
    orderRef:
      typeof order.orderId === "string"
        ? order.orderId
        : typeof order.orderRef === "string"
        ? order.orderRef
        : undefined,
    trackingNumber:
      typeof order.trackingNumber === "string" ? order.trackingNumber : undefined,
    carrier: typeof order.carrier === "string" ? order.carrier : undefined,
    lastStatus: typeof order.lastStatus === "string" ? order.lastStatus : undefined,
    lastUpdateAt:
      typeof order.lastUpdateAt === "string"
        ? order.lastUpdateAt
        : order.lastUpdateAt instanceof Date
        ? order.lastUpdateAt.toISOString()
        : undefined,
    riskLevel: typeof order.riskLevel === "string" ? order.riskLevel : undefined,
  };
};

export const getMyStore = async (
  token: string,
  userId: string
): Promise<{ storeId: string }> => {
  return request("/api/me/store", token, userId);
};

export const listOrders = async (
  token: string,
  userId: string
): Promise<OrderSummary[]> => {
  const { storeId } = await getMyStore(token, userId);

  const data = await request<{ orders: any[] }>(
    `/api/orders?storeId=${storeId}`,
    token,
    userId
  );

  return (data.orders || []).map(mapOrder);
};

export const createOrder = async (
  token: string,
  userId: string,
  input: { orderId: string; trackingNumber: string; carrier?: string }
) => {
  const { storeId } = await getMyStore(token, userId);

  return request(
    "/api/orders",
    token,
    userId,
    {
      method: "POST",
      body: JSON.stringify({
        storeId,
        orderId: input.orderId,
        trackingNumber: input.trackingNumber,
        carrier: input.carrier,
      }),
    }
  );
};

export const checkOrder = async (token: string, userId: string, id: string) => {
  return request(`/api/orders/${id}/check`, token, userId, {
    method: "POST",
  });
};
