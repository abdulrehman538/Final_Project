const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

export function resolveMediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** All image URLs for a product (main image + gallery). */
export function collectProductImageUrls(product) {
  const urls = [];
  const seen = new Set();

  const push = (raw) => {
    const resolved = resolveMediaUrl(raw);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      urls.push(resolved);
    }
  };

  if (product?.image) {
    push(product.image);
  }

  (product?.images || []).forEach((entry) => push(entry?.image));

  return urls;
}

export function resolveProductImage(product, size = "600x600") {
  const raw =
    product?.image ||
    product?.images?.[0]?.image ||
    product?.image_url ||
    "";

  if (raw) {
    return resolveMediaUrl(raw);
  }

  const label = String(product?.name || "Product").slice(0, 16);
  return `https://placehold.co/${size}/f8fafc/e2e8f0?text=${encodeURIComponent(label)}`;
}

export function getProductMeta(product) {
  const seed = String(product?.id || product?.name || "").length;
  const stock = Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 0;
  const category = product?.category || "General";
  const store = product?.store_name || "Marketplace Store";
  const rating = (4.2 + (seed % 7) * 0.1).toFixed(1);

  let stockLabel = "In stock";
  let stockTone = "ok";

  if (stock <= 0) {
    stockLabel = "Out of stock";
    stockTone = "out";
  } else if (stock <= 5) {
    stockLabel = "Low stock";
    stockTone = "low";
  }

  return { store, rating, stock, category, stockLabel, stockTone };
}
