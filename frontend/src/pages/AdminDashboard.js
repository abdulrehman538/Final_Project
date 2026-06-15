import "./AdminDashboard.css";

const overviewCards = [
  { label: "Users", value: "1,842", note: "Active buyers and sellers" },
  { label: "Sellers", value: "246", note: "Verified store owners" },
  { label: "Products", value: "10,280", note: "Live listings across stores" },
  { label: "Revenue", value: "$76.4K", note: "This quarter" },
];

const orderRows = [
  ["#2345", "Processing", "Ammar Khan", "$84.00"],
  ["#2334", "Shipped", "Sara Malik", "$129.00"],
  ["#2321", "Delivered", "Ali Raza", "$54.50"],
];

const sellerRows = [
  ["Nova Store", "Approved", "32 products"],
  ["Prime Mart", "Pending", "14 products"],
  ["Urban Goods", "Approved", "21 products"],
];

function AdminDashboard() {
  return (
    <div className="dashboard-page">
      <section className="dashboard-grid">
        {overviewCards.map((card) => (
          <div className="dashboard-card" key={card.label}>
            <p className="eyebrow">{card.label}</p>
            <h3>{card.value}</h3>
            <span className="subtext">{card.note}</span>
          </div>
        ))}
      </section>

      <section className="dashboard-panels">
        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Revenue</p>
              <h2>Monthly revenue trend</h2>
            </div>
            <span className="pill">+14%</span>
          </div>

          <div className="chart-bars">
            {[42, 58, 34, 72, 64, 88, 70].map((height, index) => (
              <div className="chart-bar" key={String(index)}>
                <span style={{ height: `${height}%` }} />
                <small>W{index + 1}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Orders</p>
              <h2>Recent orders</h2>
            </div>
            <span className="pill pill-soft">Live</span>
          </div>

          <div className="table-card">
            {orderRows.map(([order, status, customer, amount]) => (
              <div className="table-row" key={order}>
                <div>
                  <strong>{order}</strong>
                  <p className="subtext">{customer}</p>
                </div>
                <span className={`status-badge ${status === "Delivered" ? "status-badge--success" : status === "Processing" ? "status-badge--warning" : "status-badge--danger"}`}>
                  {status}
                </span>
                <strong>{amount}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-panels">
        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Stores</p>
              <h2>Seller applications</h2>
            </div>
          </div>

          <div className="table-card">
            {sellerRows.map(([seller, status, products]) => (
              <div className="table-row" key={seller}>
                <div>
                  <strong>{seller}</strong>
                  <p className="subtext">{products}</p>
                </div>
                <span className={`status-badge ${status === "Approved" ? "status-badge--success" : "status-badge--warning"}`}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Products</p>
              <h2>Low stock alerts</h2>
            </div>
            <span className="pill">4 items</span>
          </div>

          <ul className="panel-list">
            <li>Wireless Headphones - 4 left</li>
            <li>Smartwatch Series 8 - 6 left</li>
            <li>Eco-friendly Travel Mug - 2 left</li>
          </ul>
        </article>
      </section>
    </div>
  );
}

export default AdminDashboard;
