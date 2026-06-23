export function getSellerItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

export function getSellerTotal(order) {
  if (order?.seller_subtotal != null && order.seller_subtotal !== "") {
    return Number(order.seller_subtotal);
  }

  return getSellerItems(order).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
}

export function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

export function getOrderItemName(item) {
  return item.product_name || item.name || "Product";
}

export function getOrderItemStore(item) {
  return item.store_name || item.storeName || "";
}

export function getOrderItemLineTotal(item) {
  return Number(item.price || 0) * Number(item.quantity || 0);
}
