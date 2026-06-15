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
  // images state contains both newly selected files and existing image records
  // new file entries: { id, name, progress, file }
  // existing entries: { id, name, existing: true, recordId, url }
  const [category, setCategory] = useState("");
  const [storeName, setStoreName] = useState("");
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("accessToken");
  const isSeller = role === "seller";
  const isAdmin = role === "admin";

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
      const response = await fetch("http://127.0.0.1:8000/api/products/", {
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
      setProducts(data || []);
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

    getProducts();
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", String(price));
    formData.append("stock", String(stock));
    formData.append("category", category);
    formData.append("store_name", isSeller ? profileStoreName : storeName);

    // append only newly selected files (those with a `file` prop)
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

      // reset form
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

    // load existing images into the images state
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

      // remove from images state
      setImages((current) => current.filter((it) => !(it.existing && it.recordId === recordId)));
      // refresh product list to get fresh data
      await getProducts();
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
        <div className="product-item-thumb">
          <img src={`https://placehold.co/120x120/fdf2e8/f57224?text=No+Image`} alt="placeholder" />
        </div>
      );
    }

    return (
      <div className="product-item-thumb">
        <img src={getImageSrc(imgs[index])} alt={`product-${index}`} />
      </div>
    );
  }

  return (
    <div className="crud-page">
      <div className="page-panel card">
        <div className="page-header-row">
          <div>
            <p className="eyebrow">{isAdmin ? "Platform products" : "Your store products"}</p>
            <h2>{isSeller ? "Manage my products" : "Manage products"}</h2>
            <p className="subtext">
              {isSeller
                ? "Create, edit, and remove only the products that belong to your store."
                : "Create, edit, and remove items from the marketplace."}
            </p>
          </div>
          <div className="catalog-metrics">
            <div className="catalog-metric">
              <strong>{products.length}</strong>
              <span>Total products</span>
            </div>
            <div className="catalog-metric">
              <strong>{products.reduce((sum, product) => sum + Number(product.stock || 0), 0)}</strong>
              <span>Total stock</span>
            </div>
          </div>
        </div>

        <div className="product-form-grid">
          <div>
            <label className="field-label">Product Name</label>
            <input className="field-input" type="text" placeholder="Product Name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Store Name</label>
            <input
              className="field-input"
              type="text"
              placeholder="Store Name"
              value={isSeller ? profileStoreName : storeName}
              onChange={(e) => setStoreName(e.target.value)}
              readOnly={isSeller}
            />
          </div>

          <div>
            <label className="field-label">Price</label>
            <input className="field-input" type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Stock</label>
            <input className="field-input" type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Category</label>
            <input className="field-input" type="text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Product Images</label>

            <label className="image-upload-card">
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
              />

              <div className="upload-icon">📁</div>
              <div className="upload-title">Upload Product Images</div>
              <div className="upload-subtitle">JPG, PNG, WEBP</div>
            </label>

            <div className="uploaded-files">
              {images.map((image) => (
                <div className="uploaded-file" key={image.id}>
                  <div className="file-header">
                    <span className="uploaded-file-title">{image.name}</span>

                    <button
                      type="button"
                      className="remove-file"
                      onClick={() => {
                        if (image.existing) {
                          deleteProductImage(image.recordId);
                        } else {
                          revokePreviewUrl(image);
                          setImages((current) => current.filter((item) => item.id !== image.id));
                        }
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {(image.preview || (image.existing && image.url)) && (
                    <div className="uploaded-file-preview">
                      <img
                        src={image.preview || getImageSrc(image.url)}
                        alt={image.name}
                        className="uploaded-preview-img"
                      />
                    </div>
                  )}

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${image.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="full-width">
            <label className="field-label">Description</label>
            <textarea className="field-input" rows="4" placeholder="Product description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="button-row">
          {editId ? (
            <button className="btn btn-primary" onClick={updateProduct}>
              Save update
            </button>
          ) : (
            <button className="btn btn-primary" onClick={createProduct}>
              Add product
            </button>
          )}
        </div>

        {error && (
          <div className="alert-box">
            <div>{error}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={getProducts}>
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="product-list card">
        <div className="list-header">
          <h3>{isSeller ? "My inventory" : "Product inventory"}</h3>
          <span className="pill">{products.length} items</span>
        </div>

        {loading ? (
          <div className="empty-state">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">No products available. Add a new item to begin.</div>
        ) : (
          <div className="product-list-grid">
            {products.map((product) => (
              <div className="product-item" key={product.id}>
                <div className="product-item-copy">
                  <div className="product-item-thumb">
                    <ImageGallery images={(product.images || []).map((i) => i.image)} />
                  </div>
                  <div>
                    <h3>{product.name}</h3>
                    <p className="product-price">${product.price}</p>
                    <p className="subtext">
                      {product.category || "Uncategorized"} · {product.store_name || "Store"} · Stock {product.stock ?? 0}
                    </p>
                  </div>
                </div>

                <div className="product-actions">
                  <button className="btn btn-ghost" onClick={() => startEdit(product)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteProduct(product.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductCrud;
