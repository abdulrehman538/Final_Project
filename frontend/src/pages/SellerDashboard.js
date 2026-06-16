import { useEffect, useState } from "react";
import "./SellerDashboard.css";

function SellerDashboard() {
  const [products, setProducts] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const loadSellerData = async () => {
      try {
        // Fetch seller's own products
        const productsRes = await fetch("http://127.0.0.1:8000/api/seller-products/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(Array.isArray(productsData) ? productsData : []);
        } else {
          setProducts([]);
        }

        // Fetch seller's orders
        const ordersRes = await fetch("http://127.0.0.1:8000/api/seller-orders/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setSellerOrders(Array.isArray(ordersData) ? ordersData : []);
        } else {
          setSellerOrders([]);
        }
      } catch (error) {
        console.error("Dashboard data load error:", error);
        setProducts([]);
        setSellerOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadSellerData();
  }, [token]);

  const totalProducts = products.length;

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum +
      Number(product.price || 0) * Number(product.stock || 0),
    0
  );

  if (loading) {
    return <div className="empty-state">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <section className="dashboard-grid">
        <div className="dashboard-card">
          <p className="eyebrow">Products</p>
          <h3>{totalProducts}</h3>
          <span className="subtext">Products in your store</span>
        </div>

        <div className="dashboard-card">
          <p className="eyebrow">Total Stock</p>
          <h3>{totalStock}</h3>
          <span className="subtext">Units available</span>
        </div>

        <div className="dashboard-card">
          <p className="eyebrow">Inventory Value</p>
          <h3>${inventoryValue.toFixed(2)}</h3>
          <span className="subtext">Current inventory worth</span>
        </div>
      </section>

      <section className="dashboard-panels">
        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Products</p>
              <h2>Recent products</h2>
            </div>
            <span className="pill">
              {products.length} Items
            </span>
          </div>

          <div className="table-card">
            {products.length === 0 ? (
              <div className="empty-state">
                No products added yet.
              </div>
            ) : (
              products.slice(0, 5).map((product) => (
                <div
                  className="table-row"
                  key={product.id}
                >
                  <div>
                    <strong>{product.name}</strong>
                    <p className="subtext">
                      {product.category || "Uncategorized"}
                    </p>
                  </div>

                  <span className="status-badge status-badge--success">
                    Stock {product.stock || 0}
                  </span>

                  <strong>${product.price}</strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="stat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Analytics</p>
              <h2>Orders overview</h2>
            </div>
            <span className="pill">
              {sellerOrders.length} Orders
            </span>
          </div>

          <div className="table-card" style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "450px", overflowY: "auto", padding: "10px 0" }}>
            {sellerOrders.length === 0 ? (
              <div className="empty-state">
                No orders placed on your store yet.
              </div>
            ) : (
              sellerOrders.map((order) => {
                const orderDate = new Date(order.created_at).toLocaleDateString();
                const itemsTotal = order.items.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0);
                
                return (
                  <div
                    className="seller-order-card"
                    key={order.id}
                    style={{
                      padding: "16px",
                      borderRadius: "16px",
                      background: "var(--surface-soft)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                      <span><strong>Order {order.id}</strong> ({orderDate})</span>
                      <span className="status-badge status-badge--success" style={{ textTransform: "capitalize" }}>{order.status}</span>
                    </div>

                    <div style={{ fontSize: "0.88rem", display: "grid", gap: "4px" }}>
                      <p style={{ margin: 0 }}><strong>Buyer:</strong> {order.buyer_username}</p>
                      <p style={{ margin: 0 }}>
                        <strong>Total Amount:</strong> ${Number(order.total_price || 0).toFixed(2)}
                      </p>
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: "8px" }}>
                      <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "4px" }}>Items from Your Store:</strong>
                      <div style={{ display: "grid", gap: "4px" }}>
                        {order.items.map((item, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                            <span style={{ color: "var(--muted)" }}>{item.product_name} (x{item.quantity})</span>
                            <strong>${(Number(item.price || 0) * item.quantity).toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "8px", fontWeight: "bold" }}>
                      <span>Subtotal:</span>
                      <span style={{ color: "var(--primary-strong)" }}>${itemsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default SellerDashboard;