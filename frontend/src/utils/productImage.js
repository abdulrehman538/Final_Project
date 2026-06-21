const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

export function resolveProductImage(product, size = "600x600") {
  const raw =
    product?.image ||
    product?.images?.[0]?.image ||
    product?.image_url ||
    "";

  if (raw) {
    return raw.startsWith("/") ? `${API_BASE}${raw}` : raw;
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
