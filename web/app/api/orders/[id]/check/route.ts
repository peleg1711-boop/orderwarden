import { auth } from "@clerk/nextjs/server";

const getApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return baseUrl.replace(/\/$/, "");
};

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { getToken } = auth();
  const token = await getToken();

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await fetch(`${getApiBaseUrl()}/orders/${params.id}/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json"
    }
  });
}
