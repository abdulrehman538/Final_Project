import { fetchWithAuth } from "./authSession";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

export function mapServerCartItems(items = []) {
  return items
    .filter((entry) => entry?.product)
    .map(({ product, quantity }) => ({
      ...product,
      quantity,
    }));
}

export async function fetchServerCart() {
  const response = await fetchWithAuth(`${API_BASE}/api/cart/`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return mapServerCartItems(data.items || []);
}

export async function addServerCartItem(productId, quantity = 1) {
  const response = await fetchWithAuth(`${API_BASE}/api/cart/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId, quantity }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return mapServerCartItems(data.items || []);
}

export async function updateServerCartItem(productId, quantity) {
  const response = await fetchWithAuth(`${API_BASE}/api/cart/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId, quantity }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return mapServerCartItems(data.items || []);
}

export async function removeServerCartItem(productId) {
  const response = await fetchWithAuth(
    `${API_BASE}/api/cart/?product_id=${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return mapServerCartItems(data.items || []);
}

export async function clearServerCart() {
  const response = await fetchWithAuth(`${API_BASE}/api/cart/`, {
    method: "DELETE",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return mapServerCartItems(data.items || []);
}

export async function mergeLocalCartToServer(localItems = []) {
  for (const item of localItems) {
    if (item?.id == null) {
      continue;
    }

    await addServerCartItem(item.id, Math.max(1, Number(item.quantity) || 1));
  }

  return fetchServerCart();
}

export async function loadAuthenticatedCart(localItems = []) {
  let serverItems = await fetchServerCart();

  if (!serverItems) {
    return localItems;
  }

  if (!localItems.length) {
    return serverItems;
  }

  const serverIds = new Set(serverItems.map((item) => String(item.id)));
  const itemsToMerge = localItems.filter((item) => !serverIds.has(String(item.id)));

  if (!itemsToMerge.length) {
    return serverItems;
  }

  return (await mergeLocalCartToServer(itemsToMerge)) || serverItems;
}
