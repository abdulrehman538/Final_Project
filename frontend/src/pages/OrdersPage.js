const orders = [
  { id: "#ORD-1024", status: "Processing", total: "$149.00", date: "Jun 10, 2026" },
  { id: "#ORD-1011", status: "Delivered", total: "$74.50", date: "Jun 03, 2026" },
  { id: "#ORD-0998", status: "Shipped", total: "$129.00", date: "May 29, 2026" },
];

function OrdersPage() {
  return (
    <div className="orders-page">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Orders</p>
            <h2>Your order history</h2>
          </div>
        </div>

        <div className="table-card">
          {orders.map((order) => (
            <div className="table-row" key={order.id}>
              <div>
                <strong>{order.id}</strong>
                <p className="subtext">{order.date}</p>
              </div>
              <span className={`status-badge ${order.status === "Delivered" ? "status-badge--success" : order.status === "Processing" ? "status-badge--warning" : "status-badge--danger"}`}>
                {order.status}
              </span>
              <strong>{order.total}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default OrdersPage;
