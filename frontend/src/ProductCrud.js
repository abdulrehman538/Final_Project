import { useEffect, useState } from "react";
import "./ProductCrud.css";

function ProductCrud({ role = "buyer" }) {
  const [products, setProducts] = useState([]);
  const [profileStoreName, setProfileStoreName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [images, setImages] = useState([]);
  const [category, setCategory] = useState("");
  const [storeName, setStoreName] = useState("");
  const [editId, setEditId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modals & User Feedback states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const token = localStorage.getItem("accessToken");
  const isSeller = role === "seller";

  useEffect(() => {
    const loadProfile = async () => {
      if (!isSeller) {
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:8000/api/profile/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProfileStoreName(data.store_name || "");
          setStoreName(data.store_name || "");
        }
      } catch {
        const fallbackStore = localStorage.getItem("sellerStoreName") || "";
        setProfileStoreName(fallbackStore);
        setStoreName(fallbackStore);
      }
    };

    loadProfile();
  }, [isSeller, token]);

  const getProducts = async () => {
    setLoading(true);
    setError("");

    try {
      // Use different endpoint based on role
      const endpoint = isSeller 
        ? "http://127.0.0.1:8000/api/seller-products/"
        : "http://127.0.0.1:8000/api/products/";

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const msg = `Failed to load products — ${response.status} ${response.statusText} ${text}`;
        console.error(msg);
        throw new Error(msg);
      }

      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("getProducts error:", err);
      setError(err.message || "Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getProducts();
  }, [role]);

  const deleteProduct = async (id) => {
    await fetch(`http://127.0.0.1:8000/api/products/${id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    await getProducts();
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", String(price));
    formData.append("stock", String(stock));
    formData.append("category", category);
    formData.append("store_name", isSeller ? profileStoreName : storeName);

    images.forEach((img) => {
      if (img.file) {
        formData.append("images", img.file);
      }
    });

    return formData;
  };

  const createProduct = async () => {
    setLoading(true);
    setError("");

    try {
      const formData = buildFormData();

      const response = await fetch("http://127.0.0.1:8000/api/products/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Create failed — ${response.status} ${response.statusText} ${text}`);
      }

      setName("");
      setDescription("");
      setPrice("");
      setStock("");
      setImages([]);
      setCategory("");
      setStoreName(isSeller ? profileStoreName : "");
      setEditId(null);
      await getProducts();
    } catch (err) {
      console.error("createProduct error:", err);
      setError(err.message || "Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (product) => {
    setEditId(product.id);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(product.price);
    setStock(product.stock ?? "");
    setCategory(product.category || "");
    setStoreName(product.store_name || "");

    const existing = (product.images || []).map((img) => ({
      id: `exist-${img.id}`,
      name: img.image ? img.image.split('/').pop() : `img-${img.id}`,
      existing: true,
      recordId: img.id,
      url: img.image,
    }));

    setImages(existing);
  };

  const updateProduct = async () => {
    setLoading(true);
    setError("");

    try {
      const formData = buildFormData();

      const response = await fetch(`http://127.0.0.1:8000/api/products/${editId}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Update failed — ${response.status} ${response.statusText} ${text}`);
      }

      setEditId(null);
      setName("");
      setDescription("");
      setPrice("");
      setStock("");
      setImages([]);
      setCategory("");
      setStoreName(isSeller ? profileStoreName : "");
      await getProducts();
    } catch (err) {
      console.error("updateProduct error:", err);
      setError(err.message || "Failed to update product.");
    } finally {
      setLoading(false);
    }
  };

  const getImageSrc = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  const revokePreviewUrl = (image) => {
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
  };

  const filteredProducts = products
    .filter((product) => {
      const lowerQuery = searchQuery.trim().toLowerCase();
      if (!lowerQuery) return true;
      return (
        String(product.name || "").toLowerCase().includes(lowerQuery) ||
        String(product.category || "").toLowerCase().includes(lowerQuery) ||
        String(product.store_name || "").toLowerCase().includes(lowerQuery)
      );
    })
    .sort((a, b) => {
      if (sortBy === "price-low") return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === "price-high") return Number(b.price || 0) - Number(a.price || 0);
      return 0;
    });

  const deleteProductImage = async (recordId) => {
    if (!recordId) return;
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/product-images/${recordId}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Delete image failed — ${response.status} ${response.statusText} ${text}`);
      }

      setImages((current) => current.filter((it) => !(it.existing && it.recordId === recordId)));
      await getProducts();
      // Update selectedProduct reference as well if currently opened
      if (selectedProduct) {
        setSelectedProduct(prev => ({
          ...prev,
          images: prev.images.filter(img => img.id !== recordId)
        }));
      }
    } catch (err) {
      console.error("deleteProductImage error:", err);
      setError(err.message || "Failed to delete product image.");
    }
  };

  function ImageGallery({ images = [] }) {
    const imgs = images.map((i) => (typeof i === "string" ? i : i.image || i.url));
    const [index, setIndex] = useState(0);

    useEffect(() => {
      if (imgs.length < 2) return;
      const t = setInterval(() => setIndex((i) => (i + 1) % imgs.length), 3000);
      return () => clearInterval(t);
    }, [imgs.length]);

    if (!imgs || imgs.length === 0) {
      return (
        <div className="product-detail-thumb">
          <img src={`https://placehold.co/400x400/fdf2e8/f57224?text=No+Image`} alt="placeholder" style={{ width: "100%", height: "260px", objectFit: "cover", borderRadius: "16px" }} />
        </div>
      );
    }

    return (
      <div className="product-detail-thumb">
        <img src={getImageSrc(imgs[index])} alt={`product-${index}`} style={{ width: "100%", height: "260px", objectFit: "cover", borderRadius: "16px" }} />
      </div>
    );
  }

  return (
    <div className="my-store-container">
      {successMessage && (
        <div className="store-success-toast">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Products catalog column (4/5 width) */}
      <main className="store-main-content">
        <header className="store-header">
          <div>
            <h2>{isSeller ? `${profileStoreName || "My Store"} Products` : "Product Catalog"}</h2>
          </div>
          <div className="catalog-metrics">
            <div className="catalog-metric">
              <strong>{products.length}</strong>
              <span>Items</span>
            </div>
            <div className="catalog-metric">
              <strong>{products.reduce((sum, p) => sum + Number(p.stock || 0), 0)}</strong>
              <span>Stock</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="empty-state">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">No products available. Click "Add Product" to begin listing.</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">No products match your search query.</div>
        ) : (
          <div className="my-store-products-grid">
            {filteredProducts.map((product) => {
              const firstImage = (product.images && product.images[0] && product.images[0].image) || product.image_url;
              const resolvedImage = firstImage ? (firstImage.startsWith("/") ? `http://127.0.0.1:8000${firstImage}` : firstImage) : null;
              const image =
                resolvedImage ||
                `https://placehold.co/400x400/fdf2e8/f57224?text=${encodeURIComponent(String(product.name || "Product").slice(0, 10))}`;

              return (
                <article
                  className="my-store-product-card"
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsEditing(false);
                    setName(product.name || "");
                    setDescription(product.description || "");
                    setPrice(product.price || "");
                    setStock(product.stock ?? "");
                    setCategory(product.category || "");
                    setEditId(product.id);
                    const existing = (product.images || []).map((img) => ({
                      id: `exist-${img.id}`,
                      name: img.image ? img.image.split('/').pop() : `img-${img.id}`,
                      existing: true,
                      recordId: img.id,
                      url: img.image,
                    }));
                    setImages(existing);
                    setShowDetailModal(true);
                  }}
                >
                  <div className="product-card-img-container">
                    <img src={image} alt={product.name} />
                  </div>
                  <div className="product-card-info">
                    <span className="product-card-cat">{product.category || "Uncategorized"}</span>
                    <h4>{product.name}</h4>
                    <div className="product-card-price-stock">
                      <span className="price">${Number(product.price || 0).toFixed(2)}</span>
                      <span className={`stock-badge ${product.stock > 0 ? "in-stock" : "out-stock"}`}>
                        Stock: {product.stock ?? 0}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Sidebar navigation / filters column (1/5 width) */}
      <aside className="store-sidebar">
        <div className="sidebar-section">
          <button
            type="button"
            className="btn btn-primary add-product-trigger-btn"
            onClick={() => {
              setName("");
              setDescription("");
              setPrice("");
              setStock("");
              setImages([]);
              setCategory("");
              setStoreName(isSeller ? profileStoreName : "");
              setEditId(null);
              setShowAddModal(true);
            }}
          >
            + Add Product
          </button>
        </div>

        <div className="sidebar-section">
          <label className="field-label">Search Products</label>
          <input
            type="search"
            className="field-input search-input-compact"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sidebar-section">
          <label className="field-label">Sort Inventory</label>
          <select
            className="field-input select-input-compact"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="default">Default sorting</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </aside>

      {/* Add Product Dialog Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="add-product-modal card fade-in" style={{ width: "min(560px, 100%)" }}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            <div className="modal-header">
              <p className="eyebrow">Store Catalog</p>
              <h2>Add New Product</h2>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await createProduct();
                setShowAddModal(false);
                setSuccessMessage("Product added successfully!");
                setTimeout(() => setSuccessMessage(""), 3000);
              }}
              className="modal-form-content"
              style={{ display: "grid", gap: "14px", marginTop: "16px" }}
            >
              <div>
                <label className="field-label">Product Name</label>
                <input className="field-input field-input--small" type="text" placeholder="e.g. Mechanical Keyboard" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Category</label>
                  <input className="field-input field-input--small" type="text" placeholder="e.g. Keyboards" value={category} onChange={(e) => setCategory(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label">Price ($)</label>
                  <input className="field-input field-input--small" type="number" step="0.01" placeholder="e.g. 59.99" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Stock Units</label>
                  <input className="field-input field-input--small" type="number" placeholder="e.g. 20" value={stock} onChange={(e) => setStock(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label">Store Name</label>
                  <input className="field-input field-input--small" type="text" value={isSeller ? profileStoreName : storeName} readOnly={isSeller} onChange={(e) => setStoreName(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="field-label">Description</label>
                <textarea className="field-input field-input--small" rows="3" placeholder="Enter product descriptions..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <label className="field-label">Product Images</label>
                <label className="image-upload-card-compact" style={{ display: "block", border: "2px dashed var(--border)", padding: "14px", borderRadius: "12px", textAlign: "center", cursor: "pointer", background: "var(--surface-soft)" }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="image-upload-input"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      const newFiles = files.map((file) => ({
                        id: Date.now() + Math.random(),
                        name: file.name,
                        progress: 100,
                        file,
                        preview: URL.createObjectURL(file),
                      }));
                      setImages((current) => [...current, ...newFiles]);
                      e.target.value = null;
                    }}
                    style={{ display: "none" }}
                  />
                  <span>📁 Upload Image Files</span>
                </label>

                {images.length > 0 && (
                  <div className="uploaded-thumbnails" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                    {images.map((img) => (
                      <div className="uploaded-thumbnail-item" key={img.id} style={{ position: "relative", width: "64px", height: "64px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                        <img src={img.preview || getImageSrc(img.url)} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={() => {
                            if (img.existing) {
                              deleteProductImage(img.recordId);
                            } else {
                              revokePreviewUrl(img);
                              setImages(prev => prev.filter(x => x.id !== img.id));
                            }
                          }}
                          style={{ position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "none", fontSize: "10px", cursor: "pointer" }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions-row" style={{ display: "flex", gap: "12px", marginTop: "14px", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail / Edit Dialog Modal */}
      {showDetailModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="product-details-modal card fade-in" style={{ width: "min(560px, 100%)", padding: "32px" }}>
            <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>

            {isEditing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await updateProduct();
                  setIsEditing(false);
                  setShowDetailModal(false);
                  setSuccessMessage("Product updated successfully!");
                  setTimeout(() => setSuccessMessage(""), 3000);
                }}
                className="modal-form-content"
                style={{ display: "grid", gap: "14px" }}
              >
                <div className="modal-header">
                  <p className="eyebrow">Catalog Administration</p>
                  <h2>Edit Product</h2>
                </div>

                <div>
                  <label className="field-label">Product Name</label>
                  <input className="field-input field-input--small" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="field-label">Category</label>
                    <input className="field-input field-input--small" type="text" value={category} onChange={(e) => setCategory(e.target.value)} required />
                  </div>
                  <div>
                    <label className="field-label">Price ($)</label>
                    <input className="field-input field-input--small" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="field-label">Stock Units</label>
                    <input className="field-input field-input--small" type="number" value={stock} onChange={(e) => setStock(e.target.value)} required />
                  </div>
                  <div>
                    <label className="field-label">Store Name</label>
                    <input className="field-input field-input--small" type="text" value={isSeller ? profileStoreName : storeName} readOnly={isSeller} onChange={(e) => setStoreName(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="field-label">Description</label>
                  <textarea className="field-input field-input--small" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div>
                  <label className="field-label">Product Images</label>
                  <label className="image-upload-card-compact" style={{ display: "block", border: "2px dashed var(--border)", padding: "14px", borderRadius: "12px", textAlign: "center", cursor: "pointer", background: "var(--surface-soft)" }}>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="image-upload-input"
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        const newFiles = files.map((file) => ({
                          id: Date.now() + Math.random(),
                          name: file.name,
                          progress: 100,
                          file,
                          preview: URL.createObjectURL(file),
                        }));
                        setImages((current) => [...current, ...newFiles]);
                        e.target.value = null;
                      }}
                      style={{ display: "none" }}
                    />
                    <span>📁 Add More Images</span>
                  </label>

                  {images.length > 0 && (
                    <div className="uploaded-thumbnails" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                      {images.map((img) => (
                        <div className="uploaded-thumbnail-item" key={img.id} style={{ position: "relative", width: "64px", height: "64px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                          <img src={img.preview || getImageSrc(img.url)} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button
                            type="button"
                            onClick={() => {
                              if (img.existing) {
                                deleteProductImage(img.recordId);
                              } else {
                                revokePreviewUrl(img);
                                setImages(prev => prev.filter(x => x.id !== img.id));
                              }
                            }}
                            style={{ position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "none", fontSize: "10px", cursor: "pointer" }}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-actions-row" style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "14px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel Edit</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            ) : (
              <div className="product-details-view">
                <div className="modal-header">
                  <p className="eyebrow">{selectedProduct.category || "Uncategorized"}</p>
                  <h2>{selectedProduct.name}</h2>
                </div>

                <div className="details-body" style={{ marginTop: "16px" }}>
                  <div className="details-image-gallery" style={{ marginBottom: "20px" }}>
                    <ImageGallery images={(selectedProduct.images || []).map((i) => i.image)} />
                  </div>

                  <div className="details-info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "20px 0" }}>
                    <div className="detail-info-block" style={{ padding: "14px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Unit Price</span>
                      <strong style={{ fontSize: "1.35rem", color: "var(--primary-strong)" }}>${Number(selectedProduct.price || 0).toFixed(2)}</strong>
                    </div>
                    <div className="detail-info-block" style={{ padding: "14px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Stock Available</span>
                      <strong style={{ fontSize: "1.35rem", color: selectedProduct.stock > 0 ? "var(--success)" : "var(--danger)" }}>
                        {selectedProduct.stock ?? 0} units
                      </strong>
                    </div>
                  </div>

                  <div className="detail-description">
                    <h4 style={{ margin: "0 0 8px 0" }}>Product Description</h4>
                    <p className="subtext" style={{ fontSize: "0.95rem", lineHeight: "1.6" }}>{selectedProduct.description || "No description provided."}</p>
                  </div>
                </div>

                <div className="modal-actions-row" style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Product
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to delete this product?")) {
                        await deleteProduct(selectedProduct.id);
                        setShowDetailModal(false);
                        setSuccessMessage("Product deleted successfully!");
                        setTimeout(() => setSuccessMessage(""), 3000);
                      }
                    }}
                  >
                    Delete Product
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductCrud;
