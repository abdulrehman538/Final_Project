export const ORDER_STATUS_FLOW = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
];

export function getOrderStatusLabel(status) {
  const match = ORDER_STATUS_FLOW.find((step) => step.key === status);
  if (match) {
    return match.label;
  }
  if (status === "cancelled") {
    return "Cancelled";
  }
  return status ? String(status).replace(/_/g, " ") : "Unknown";
}

export function getOrderStatusClass(status) {
  const normalized = (status || "pending").toLowerCase();
  if (["delivered", "completed"].includes(normalized)) {
    return "order-status order-status--success";
  }
  if (normalized === "cancelled") {
    return "order-status order-status--cancelled";
  }
  if (["confirmed", "shipped"].includes(normalized)) {
    return "order-status order-status--progress";
  }
  return "order-status order-status--pending";
}

export function getOrderProgressIndex(status) {
  if (status === "cancelled") {
    return -1;
  }
  const index = ORDER_STATUS_FLOW.findIndex((step) => step.key === status);
  return index >= 0 ? index : 0;
}

export function parseOrderNumberInput(value) {
  return String(value || "").trim().replace(/^#/, "");
}
