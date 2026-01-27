import { auth } from "@clerk/nextjs/server";
import CheckNowButton from "../../components/CheckNowButton";
import RiskBadge from "../../components/RiskBadge";
import { listOrders } from "../../lib/api";

export default async function OrdersPage() {
  const { userId, getToken } = auth();
  const token = await getToken();

  if (!token || !userId) {
    return <h1>Orders</h1>;
  }

  const orders = await listOrders(token, userId);

  return (
    <div className="page">
      <h1>Orders</h1>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Order Ref</th>
              <th>Tracking</th>
              <th>Carrier</th>
              <th>Status</th>
              <th>Last Update</th>
              <th>Risk</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-state">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order, index) => (
                <tr
                  key={
                    order.id ??
                    order.orderRef ??
                    order.trackingNumber ??
                    `order-${index}`
                  }
                >
                  <td>{order.orderRef ?? "-"}</td>
                  <td>{order.trackingNumber ?? "-"}</td>
                  <td>{order.carrier ?? "-"}</td>
                  <td>{order.lastStatus ?? "-"}</td>
                  <td>{order.lastUpdateAt ?? "-"}</td>
                  <td>
                    <RiskBadge riskLevel={order.riskLevel} />
                  </td>
                  <td>
                    <CheckNowButton id={order.id} token={token} userId={userId} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
