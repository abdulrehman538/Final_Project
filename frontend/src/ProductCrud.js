import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithAuth } from "./utils/authSession";
import { collectProductImageUrls, resolveMediaUrl, resolveProductImage } from "./utils/productImage";
import ModalCloseButton from "./components/ModalCloseButton";
import "./ProductCrud.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function toEditableImageState(product) {
  const items = [];

  if (product?.image) {
    items.push({
      id: `main-${product.id}`,
      name: product.image.split("/").pop() || "main.jpg",
      existing: true,
      isMain: true,
      recordId: null,
      url: product.image,
    });
  }

  (product?.images || []).forEach((img) => {
    items.push({
      id: `exist-${img.id}`,
      name: img.image?.split("/").pop() || `img-${img.id}`,
      existing: true,
      recordId: img.id,
      url: img.image,
    });
  });

  return items;
}

function ProductCrud({ role = "user" }) {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [successMessage, setSuccessMessage] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const isSeller = role === "seller";

  useEffect(() => {
    const loadProfile = async () => {
      if (!isSeller) {
        return;
      }

      try {
        const response = await fetchWithAuth(`${API_BASE}/api/profile/`);

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
  }, [isSeller]);

  const getProducts = async () => {
    setLoading(true);

    try {
      // Use different endpoint based on role
      const endpoint = isSeller
        ? `${API_BASE}/api/seller-products/`
        : `${API_BASE}/api/products/`;

      const response = await fetchWithAuth(endpoint);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getProducts();
  }, [role]);

  const deleteProduct = async (id) => {
    await fetchWithAuth(`${API_BASE}/api/products/${id}/`, {
      method: "DELETE",
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

    try {
      const formData = buildFormData();

      const response = await fetchWithAuth(`${API_BASE}/api/products/`, {
        method: "POST",
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
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async () => {
    setLoading(true);

    try {
      const formData = buildFormData();

      const response = await fetchWithAuth(`${API_BASE}/api/products/${editId}/`, {
        method: "PATCH",
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
    } finally {
      setLoading(false);
    }
  };

  const revokePreviewUrl = (image) => {
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
  };

  const openProductModal = (product, startInEditMode = false) => {
    setSelectedProduct(product);
    setIsEditing(startInEditMode);
    setName(product.name || "");
    setDescription(product.description || "");
    setPrice(product.price || "");
    setStock(product.stock ?? "");
    setCategory(product.category || "");
    setEditId(product.id);
    setImages(toEditableImageState(product));
    setActiveImageIndex(0);
    setShowDetailModal(true);
  };

  const closeProductModal = () => {
    images.forEach(revokePreviewUrl);
    setShowDetailModal(false);
    setSelectedProduct(null);
    setIsEditing(false);
    setActiveImageIndex(0);
    setEditId(null);
  };

  const getThumbSrc = (img) => {
    if (!img) return resolveProductImage(selectedProduct || {}, "400x400");
    return img.preview || resolveMediaUrl(img.url);
  };

  const handleImageUpload = (fileList) => {
    const files = Array.from(fileList);
    const newFiles = files.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((current) => {
      const next = [...current, ...newFiles];
      if (current.length === 0) {
        setActiveImageIndex(0);
      }
      return next;
    });
  };

  const removeImageAt = (img) => {
    if (img.existing && img.recordId) {
      deleteProductImage(img.recordId);
      return;
    }
    revokePreviewUrl(img);
    setImages((prev) => {
      const next = prev.filter((x) => x.id !== img.id);
      setActiveImageIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  useEffect(() => {
    const rawId = location.state?.viewProductId;
    if (!rawId || products.length === 0) {
      return;
    }

    const targetId = Number(rawId);
    const product = products.find((p) => p.id === targetId);
    if (!product) {
      return;
    }

    openProductModal(product, false);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state?.viewProductId, products, location.pathname, navigate]);

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
      const response = await fetchWithAuth(`${API_BASE}/api/product-images/${recordId}/`, {
        method: "DELETE",
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
    }
  };

  function ImageGallery({ product }) {
    const urls = collectProductImageUrls(product);
    const [index, setIndex] = useState(0);

    useEffect(() => {
      setIndex(0);
    }, [product?.id]);

    useEffect(() => {
      if (urls.length < 2) return undefined;
      const timer = setInterval(() => setIndex((i) => (i + 1) % urls.length), 4000);
      return () => clearInterval(timer);
    }, [urls.length]);

    const hero = urls[index] || resolveProductImage(product, "600x600");

    return (
      <div className="store-gallery">
        <div className="store-gallery__hero">
          <img src={hero} alt={product?.name || "Product"} />
        </div>
        {urls.length > 1 && (
          <div className="store-gallery__thumbs">
            {urls.map((src, thumbIndex) => (
              <button
                key={src}
                type="button"
                className={`store-gallery__thumb${index === thumbIndex ? " is-active" : ""}`}
                onClick={() => setIndex(thumbIndex)}
                aria-label={`View image ${thumbIndex + 1}`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const editHeroSrc =
    images.length > 0
      ? getThumbSrc(images[activeImageIndex] || images[0])
      : resolveProductImage(selectedProduct || {}, "600x600");

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
          <div className="store-header__actions">
            {isSeller && (
              <button
                type="button"
                className="store-orders-btn"
                onClick={() => navigate("/seller-orders")}
              >
                Orders
              </button>
            )}
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
              const image = resolveProductImage(product, "400x400");

              return (
                <article
                  className="my-store-product-card"
                  key={product.id}
                  onClick={() => openProductModal(product, false)}
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

      {showAddModal && (
        <div className="store-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="store-modal store-modal--compact"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-product-title"
          >
            <ModalCloseButton onClick={() => setShowAddModal(false)} />
            <header className="store-modal__header">
              <p className="store-modal__eyebrow">Store catalog</p>
              <h2 id="add-product-title">Add new product</h2>
            </header>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await createProduct();
                setShowAddModal(false);
                setSuccessMessage("Product added successfully!");
                setTimeout(() => setSuccessMessage(""), 3000);
              }}
              className="store-modal__form"
            >
              <div className="store-form-field">
                <label className="field-label">Product name</label>
                <input className="field-input field-input--small" type="text" placeholder="e.g. Mechanical Keyboard" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="store-form-row">
                <div className="store-form-field">
                  <label className="field-label">Category</label>
                  <input className="field-input field-input--small" type="text" placeholder="e.g. Keyboards" value={category} onChange={(e) => setCategory(e.target.value)} required />
                </div>
                <div className="store-form-field">
                  <label className="field-label">Price ($)</label>
                  <input className="field-input field-input--small" type="number" step="0.01" placeholder="e.g. 59.99" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
              </div>

              <div className="store-form-row">
                <div className="store-form-field">
                  <label className="field-label">Stock units</label>
                  <input className="field-input field-input--small" type="number" placeholder="e.g. 20" value={stock} onChange={(e) => setStock(e.target.value)} required />
                </div>
                <div className="store-form-field">
                  <label className="field-label">Store name</label>
                  <input className="field-input field-input--small" type="text" value={isSeller ? profileStoreName : storeName} readOnly={isSeller} onChange={(e) => setStoreName(e.target.value)} />
                </div>
              </div>

              <div className="store-form-field">
                <label className="field-label">Description</label>
                <textarea className="field-input field-input--small" rows="3" placeholder="Enter product description…" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="store-form-field">
                <label className="field-label">Product images</label>
                <label className="store-upload-zone">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="image-upload-input"
                    onChange={(e) => {
                      handleImageUpload(e.target.files);
                      e.target.value = null;
                    }}
                  />
                  <span className="store-upload-zone__icon">+</span>
                  <span className="store-upload-zone__text">Upload photos</span>
                </label>

                {images.length > 0 && (
                  <div className="store-image-strip">
                    {images.map((img, imgIndex) => (
                      <div className="store-image-strip__item" key={img.id}>
                        <img src={getThumbSrc(img)} alt="" />
                        <button type="button" className="store-image-strip__remove" onClick={() => removeImageAt(img)} aria-label="Remove image">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="store-modal__footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add product</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedProduct && (
        <div className="store-modal-overlay" onClick={closeProductModal}>
          <div
            className={`store-modal${isEditing ? " store-modal--edit" : " store-modal--detail"}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <ModalCloseButton onClick={closeProductModal} />

            {isEditing ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await updateProduct();
                  setIsEditing(false);
                  setSelectedProduct((prev) =>
                    prev
                      ? {
                          ...prev,
                          name,
                          description,
                          price,
                          stock: Number(stock),
                          category,
                        }
                      : prev
                  );
                  setSuccessMessage("Product updated successfully!");
                  setTimeout(() => setSuccessMessage(""), 3000);
                }}
                className="store-edit-layout"
              >
                <header className="store-modal__header store-modal__header--border">
                  <div>
                    <p className="store-modal__eyebrow">Edit listing</p>
                    <h2 id="product-modal-title">{name || "Product"}</h2>
                    <p className="store-modal__meta">ID #{editId} · {category || "Uncategorized"}</p>
                  </div>
                </header>

                <div className="store-edit-layout__body">
                  <aside className="store-edit-media">
                    <div className="store-edit-media__hero">
                      <img src={editHeroSrc} alt={name || "Product preview"} />
                    </div>

                    {images.length > 0 && (
                      <div className="store-image-strip store-image-strip--large">
                        {images.map((img, imgIndex) => (
                          <div
                            key={img.id}
                            className={`store-image-strip__item store-image-strip__item--selectable${activeImageIndex === imgIndex ? " is-active" : ""}`}
                            onClick={() => setActiveImageIndex(imgIndex)}
                            onKeyDown={(e) => e.key === "Enter" && setActiveImageIndex(imgIndex)}
                            role="button"
                            tabIndex={0}
                          >
                            <img src={getThumbSrc(img)} alt="" />
                            {img.recordId && (
                              <button
                                type="button"
                                className="store-image-strip__remove"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImageAt(img);
                                }}
                                aria-label="Remove image"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="store-upload-zone store-upload-zone--inline">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          handleImageUpload(e.target.files);
                          e.target.value = null;
                        }}
                      />
                      <span className="store-upload-zone__icon">+</span>
                      <span className="store-upload-zone__text">Add more photos</span>
                    </label>
                  </aside>

                  <div className="store-edit-fields">
                    <div className="store-form-field">
                      <label className="field-label">Product name</label>
                      <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    <div className="store-form-row">
                      <div className="store-form-field">
                        <label className="field-label">Category</label>
                        <input className="field-input" type="text" value={category} onChange={(e) => setCategory(e.target.value)} required />
                      </div>
                      <div className="store-form-field">
                        <label className="field-label">Price ($)</label>
                        <input className="field-input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
                      </div>
                    </div>

                    <div className="store-form-row">
                      <div className="store-form-field">
                        <label className="field-label">Stock units</label>
                        <input className="field-input" type="number" value={stock} onChange={(e) => setStock(e.target.value)} required />
                      </div>
                      <div className="store-form-field">
                        <label className="field-label">Store name</label>
                        <input className="field-input" type="text" value={isSeller ? profileStoreName : storeName} readOnly={isSeller} onChange={(e) => setStoreName(e.target.value)} />
                      </div>
                    </div>

                    <div className="store-form-field">
                      <label className="field-label">Description</label>
                      <textarea className="field-input" rows="5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your product for buyers…" />
                    </div>
                  </div>
                </div>

                <footer className="store-modal__footer store-modal__footer--split">
                  <button
                    type="button"
                    className="btn btn-danger btn-ghost"
                    onClick={async () => {
                      if (window.confirm("Delete this product permanently?")) {
                        await deleteProduct(selectedProduct.id);
                        closeProductModal();
                        setSuccessMessage("Product deleted successfully!");
                        setTimeout(() => setSuccessMessage(""), 3000);
                      }
                    }}
                  >
                    Delete product
                  </button>
                  <div className="store-modal__footer-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>View details</button>
                    <button type="submit" className="btn btn-primary">Save changes</button>
                  </div>
                </footer>
              </form>
            ) : (
              <div className="store-detail-layout">
                <header className="store-modal__header store-modal__header--border">
                  <div>
                    <p className="store-modal__eyebrow">{selectedProduct.category || "Uncategorized"}</p>
                    <h2 id="product-modal-title">{selectedProduct.name}</h2>
                    <p className="store-modal__meta">{selectedProduct.store_name || profileStoreName}</p>
                  </div>
                </header>

                <div className="store-detail-layout__body">
                  <ImageGallery product={selectedProduct} />

                  <div className="store-detail-stats">
                    <div className="store-detail-stat">
                      <span>Unit price</span>
                      <strong>${Number(selectedProduct.price || 0).toFixed(2)}</strong>
                    </div>
                    <div className="store-detail-stat">
                      <span>Stock available</span>
                      <strong className={selectedProduct.stock > 0 ? "is-ok" : "is-low"}>
                        {selectedProduct.stock ?? 0} units
                      </strong>
                    </div>
                  </div>

                  <div className="store-detail-description">
                    <h3>Description</h3>
                    <p>{selectedProduct.description || "No description provided."}</p>
                  </div>
                </div>

                <footer className="store-modal__footer">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setName(selectedProduct.name || "");
                      setDescription(selectedProduct.description || "");
                      setPrice(selectedProduct.price || "");
                      setStock(selectedProduct.stock ?? "");
                      setCategory(selectedProduct.category || "");
                      setImages(toEditableImageState(selectedProduct));
                      setActiveImageIndex(0);
                      setIsEditing(true);
                    }}
                  >
                    Edit info
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (window.confirm("Delete this product permanently?")) {
                        await deleteProduct(selectedProduct.id);
                        closeProductModal();
                        setSuccessMessage("Product deleted successfully!");
                        setTimeout(() => setSuccessMessage(""), 3000);
                      }
                    }}
                  >
                    Delete
                  </button>
                </footer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductCrud;
