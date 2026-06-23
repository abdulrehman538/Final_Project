import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  getOrderProgressIndex,
  getOrderStatusClass,
  getOrderStatusLabel,
  ORDER_STATUS_FLOW,
  parseOrderNumberInput,
} from "../utils/orderStatus";
import "./TrackOrderPage.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

function formatTrackDate(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function TrackOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const preset =
      location.state?.orderId ||
      searchParams.get("order") ||
      searchParams.get("order_id") ||
      "";

    if (preset) {
      setOrderNumber(String(preset));
    }
  }, [location.state, searchParams]);

  useEffect(() => {
    if (!location.state?.orderId || result || loading || error) {
      return undefined;
    }

    const cleaned = parseOrderNumberInput(location.state.orderId);
    if (!cleaned) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const form = document.getElementById("track-order-form");
      form?.requestSubmit();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.state, result, loading, error]);

  const handleTrack = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    const cleaned = parseOrderNumberInput(orderNumber);
    if (!cleaned) {
      setError("Enter your order number.");
      return;
    }

    if (!/^\d+$/.test(cleaned)) {
      setError("Order number must be numeric (example: 42).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/orders/track/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: cleaned }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.detail || "Order not found. Check the order number and try again.");
        return;
      }

      setResult(data);
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const progressIndex = result ? getOrderProgressIndex(result.status) : -1;
  const isCancelled = result?.status === "cancelled";
  const progressPercent =
    progressIndex >= 0
      ? (progressIndex / Math.max(ORDER_STATUS_FLOW.length - 1, 1)) * 100
      : 0;

  return (
    <div className="track-page">
      <section className="track-hero">
        <p className="track-hero__eyebrow">Order tracking</p>
        <h1>Track your order</h1>
        <p>Enter your order number from checkout to see live delivery status.</p>
      </section>

      <section className="track-search-wrap">
        <form id="track-order-form" className="track-search" onSubmit={handleTrack}>
          <label className="sr-only" htmlFor="order-number">
            Order number
          </label>
          <div className="track-search__bar">
            <span className="track-search__prefix">#</span>
            <input
              id="order-number"
              className="track-search__input"
              type="text"
              inputMode="numeric"
              placeholder="Enter order number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary track-search__btn" disabled={loading}>
              {loading ? "Checking..." : "Track"}
            </button>
          </div>
          <p className="track-search__hint">
            You received this number after checkout. Only order status is shown here.
          </p>
          {error ? <div className="track-alert">{error}</div> : null}
        </form>

        {!result ? (
          <div className="track-help">
            <p>Complete checkout, save your order number, and track it here anytime.</p>
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="track-detail" aria-live="polite">
          <div className="track-detail__header">
            <div>
              <span className="track-detail__label">Order number</span>
              <h2>#{result.id}</h2>
            </div>
            <span className={getOrderStatusClass(result.status)}>
              {result.status_label || getOrderStatusLabel(result.status)}
            </span>
          </div>

          {isCancelled ? (
            <div className="track-cancelled">
              This order was cancelled. Contact support if you need help.
            </div>
          ) : (
            <div className="track-progress">
              <div className="track-progress__rail">
                <div
                  className="track-progress__fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="track-progress__steps">
                {ORDER_STATUS_FLOW.map((step, index) => {
                  const isComplete = progressIndex >= index;
                  const isCurrent = progressIndex === index;

                  return (
                    <div
                      key={step.key}
                      className={`track-progress__step${isComplete ? " is-complete" : ""}${isCurrent ? " is-current" : ""}`}
                    >
                      <span className="track-progress__dot" aria-hidden="true">
                        {isComplete ? "✓" : index + 1}
                      </span>
                      <span className="track-progress__label">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="track-detail__meta">
            <div className="track-detail__meta-item">
              <span>Order placed</span>
              <strong>{formatTrackDate(result.created_at)}</strong>
            </div>
            <div className="track-detail__meta-item">
              <span>Last updated</span>
              <strong>{formatTrackDate(result.updated_at)}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <div className="track-footer-actions">
        <button type="button" className="btn btn-secondary" onClick={() => navigate("/marketplace")}>
          Back to marketplace
        </button>
      </div>
    </div>
  );
}

export default TrackOrderPage;
