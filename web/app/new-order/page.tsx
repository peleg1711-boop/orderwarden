import { auth } from "@clerk/nextjs/server";
import NewOrderForm from "./NewOrderForm";

export default async function NewOrderPage() {
  const { userId, getToken } = auth();

  const token = await getToken();

  if (!token || !userId) {
    return (
      <div style={{ padding: 40 }}>
        <h1>New Order</h1>
        <p>You must be signed in.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>New Order</h1>
      <NewOrderForm token={token} userId={userId} />
    </div>
  );
}
