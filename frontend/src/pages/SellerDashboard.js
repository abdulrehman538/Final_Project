import { useEffect, useState } from "react";
import "./SellerDashboard.css";

function SellerDashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/products/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProducts(data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
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
          </div>

          <div className="empty-state">
            Order analytics will appear here once
            order management is implemented.
          </div>
        </article>
      </section>
    </div>
  );
}

export default SellerDashboard;