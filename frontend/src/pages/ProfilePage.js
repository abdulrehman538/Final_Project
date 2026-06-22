import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/authSession";
import { isAdmin, normalizeRole } from "../utils/roles";
import ModalCloseButton from "../components/ModalCloseButton";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const emptyProfile = {
  full_name: "",
  phone: "",
  address: "",
  bio: "",
  avatar_url: "",
  email: "",
  username: "",
  store_name: "",
  business_description: "",
  contact_phone: "",
  terms_accepted: false,
  is_seller: false,
  seller_status: "none",
};

function ProfilePage({ onBecomeSeller }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(emptyProfile);
  const [addressFields, setAddressFields] = useState({
    detail: "",
    address1: "",
    address2: "",
    address3: "",
    postal_code: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sellerMode, setSellerMode] = useState(false);
  const [sellerForm, setSellerForm] = useState({
    store_name: "",
    business_description: "",
    contact_phone: "",
    terms_accepted: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isAdminUser = isAdmin(normalizeRole(localStorage.getItem("userRole")));
  const showBecomeSellerSection = !profile.is_seller && !isAdminUser;

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetchWithAuth(`${API_BASE}/api/profile/`);

        if (!response.ok) {
          throw new Error("Unable to load profile");
        }

        const data = await response.json();
        setProfile((current) => ({ ...current, ...data, email: data.email || "" }));
        setSellerForm((current) => ({
          ...current,
          store_name: data.store_name || "",
          business_description: data.business_description || "",
          contact_phone: data.contact_phone || "",
          terms_accepted: Boolean(data.terms_accepted),
        }));

        try {
          if (data.address) {
            const parsed = JSON.parse(data.address);
            setAddressFields({
              detail: parsed.detail || "",
              address1: parsed.address1 || "",
              address2: parsed.address2 || "",
              address3: parsed.address3 || "",
              postal_code: parsed.postal_code || "",
            });
          }
        } catch {
          setAddressFields({
            detail: "",
            address1: data.address || "",
            address2: "",
            address3: "",
            postal_code: "",
          });
        }
      } catch {
        setProfile((current) => ({
          ...current,
          username: localStorage.getItem("username") || "",
        }));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const handleSellerFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSellerForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const addressJson = JSON.stringify({
      detail: addressFields.detail,
      address1: addressFields.address1,
      address2: addressFields.address2,
      address3: addressFields.address3,
      postal_code: addressFields.postal_code,
    });

    const updatedProfile = {
      ...profile,
      address: addressJson,
    };

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/profile/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedProfile),
      });

      if (!response.ok) {
        throw new Error("Unable to save profile");
      }

      const data = await response.json();
      setProfile((current) => ({ ...current, ...data }));
      setMessage("Profile updated successfully.");
    } catch {
      setMessage("Profile updated locally.");
    } finally {
      setSaving(false);
    }
  };

  const openSellerModal = () => {
    setSellerForm({
      store_name: profile.store_name || "",
      business_description: profile.business_description || "",
      contact_phone: profile.contact_phone || "",
      terms_accepted: Boolean(profile.terms_accepted),
    });
    setSellerMode(true);
    setError("");
    setMessage("");
  };

  const handleBecomeSeller = async (event) => {
    event.preventDefault();

    if (!sellerForm.store_name.trim()) {
      setError("Store name is required.");
      return;
    }

    if (!sellerForm.business_description.trim()) {
      setError("Please tell us about your business.");
      return;
    }

    if (!sellerForm.contact_phone.trim()) {
      setError("Contact phone is required.");
      return;
    }

    if (!sellerForm.terms_accepted) {
      setError("You must accept the terms and conditions.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/profile/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...profile,
          store_name: sellerForm.store_name.trim(),
          business_description: sellerForm.business_description.trim(),
          contact_phone: sellerForm.contact_phone.trim(),
          terms_accepted: true,
          is_seller: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to upgrade to seller");
      }

      const data = await response.json();
      setProfile((current) => ({
        ...current,
        ...data,
        store_name: sellerForm.store_name.trim(),
        business_description: sellerForm.business_description.trim(),
        contact_phone: sellerForm.contact_phone.trim(),
        terms_accepted: true,
        is_seller: false,
        seller_status: data.seller_status || "pending",
      }));
      localStorage.setItem("sellerStoreName", sellerForm.store_name.trim());
      setMessage("Your seller application has been submitted and is pending admin approval.");
      if (onBecomeSeller) {
        onBecomeSeller(sellerForm.store_name.trim());
      }
    } catch {
      setError("Unable to become seller right now.");
    } finally {
      setSaving(false);
      setSellerMode(false);
    }
  };

  if (loading) {
    return <div className="empty-state">Loading profile...</div>;
  }

  return (
    <div className="profile-page">
      <section className="card profile-grid">
        <div className="profile-panel">
          <p className="eyebrow">Profile</p>
          <h2>Manage your account details</h2>
          <p className="subtext">
            {isAdminUser
              ? "Edit your contact information and account details."
              : "Edit your contact information, bio, and public seller details."}
          </p>

          <div className="profile-avatar">{(profile.username || "U").slice(0, 1).toUpperCase()}</div>

          {showBecomeSellerSection && (
            <div className="seller-upgrade-box">
              <p className="eyebrow">Want to become seller?</p>
              <p className="subtext">Set up your store profile and review the seller terms before you start listing products.</p>
              {profile.seller_status === "pending" && (
                <div className="auth-alert auth-alert-success" style={{ marginBottom: "12px" }}>
                  Your seller application is pending admin approval.
                </div>
              )}
              {profile.seller_status === "rejected" && (
                <div className="auth-alert" style={{ marginBottom: "12px" }}>
                  Your seller application was rejected. Please contact support for help.
                </div>
              )}
              <button type="button" className="btn btn-primary" onClick={openSellerModal}>
                Become Seller
              </button>

              {sellerMode && (
                <div className="seller-upgrade-modal-backdrop" role="presentation">
                  <div className="seller-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="seller-onboarding-title">
                    <div className="seller-upgrade-modal__header">
                      <div>
                        <p className="eyebrow">Seller Onboarding</p>
                        <h3 id="seller-onboarding-title">Become a seller</h3>
                        <p className="subtext">Set up your store profile, share your business details, and accept the seller agreement in one step.</p>
                      </div>
                      <ModalCloseButton inline onClick={() => setSellerMode(false)} />
                    </div>

                    <div className="seller-upgrade-modal__summary">
                      <span className="pill pill-soft">Why sellers use this</span>
                      <ul className="seller-upgrade-benefits">
                        <li>List and manage your own products from one dashboard.</li>
                        <li>Show customers a clear store identity and contact details.</li>
                        <li>Build trust with a verified seller agreement and terms.</li>
                      </ul>
                    </div>

                    <form className="seller-upgrade-form" onSubmit={handleBecomeSeller}>
                      <label className="field-label" htmlFor="seller-store-name">Store Name</label>
                      <input
                        id="seller-store-name"
                        className="field-input"
                        type="text"
                        name="store_name"
                        placeholder="Enter store name"
                        value={sellerForm.store_name}
                        onChange={handleSellerFieldChange}
                      />

                      <label className="field-label" htmlFor="seller-business-description">Business Description</label>
                      <textarea
                        id="seller-business-description"
                        className="field-input"
                        name="business_description"
                        rows="4"
                        placeholder="Tell customers what you sell and what makes your store unique"
                        value={sellerForm.business_description}
                        onChange={handleSellerFieldChange}
                      />

                      <label className="field-label" htmlFor="seller-contact-phone">Contact Phone</label>
                      <input
                        id="seller-contact-phone"
                        className="field-input"
                        type="tel"
                        name="contact_phone"
                        placeholder="Enter contact number"
                        value={sellerForm.contact_phone}
                        onChange={handleSellerFieldChange}
                      />

                      <div className="seller-upgrade-modal__terms">
                        <h4>Terms and Conditions</h4>
                        <p>
                          By becoming a seller, you agree to provide accurate product information,
                          honor orders promptly, and follow marketplace policies. Misleading listings
                          or repeated policy violations may lead to account review or suspension.
                        </p>
                      </div>

                      <label className="seller-checkbox">
                        <input
                          type="checkbox"
                          name="terms_accepted"
                          checked={sellerForm.terms_accepted}
                          onChange={handleSellerFieldChange}
                        />
                        <span>I agree to the terms and conditions</span>
                      </label>

                      <div className="seller-upgrade-modal__actions">
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                          {saving ? "Updating..." : "Activate Seller"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setSellerMode(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {profile.is_seller && (
            <div className="seller-status-card">
              <p className="eyebrow">Seller Store</p>
              <strong>{profile.store_name || "Your Store"}</strong>
              <p className="subtext">You can add, delete, and manage your own products and stock.</p>
            </div>
          )}
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="field-label">Username</label>
          <input className="field-input" name="username" value={profile.username} readOnly />
          <p className="subtext">Username is used for sign-in and display only.</p>

          <label className="field-label">Email</label>
          <input className="field-input" type="email" name="email" value={profile.email} onChange={handleChange} />

          <label className="field-label">Full Name</label>
          <input className="field-input" name="full_name" value={profile.full_name} onChange={handleChange} />

          <label className="field-label">Phone</label>
          <input className="field-input" name="phone" value={profile.phone} onChange={handleChange} />

          <label className="field-label">Address Line 1</label>
          <input
            className="field-input"
            name="address1"
            placeholder="House/Apartment No, building name"
            value={addressFields.address1}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, address1: e.target.value }))}
            required
          />

          <label className="field-label">Address Line 2</label>
          <input
            className="field-input"
            name="address2"
            placeholder="Street, area, colony name"
            value={addressFields.address2}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, address2: e.target.value }))}
          />

          <label className="field-label">Address Line 3</label>
          <input
            className="field-input"
            name="address3"
            placeholder="Landmark, city, state"
            value={addressFields.address3}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, address3: e.target.value }))}
          />

          <label className="field-label">Postal / Zip Code</label>
          <input
            className="field-input"
            name="postal_code"
            placeholder="Enter postal / zip code"
            value={addressFields.postal_code}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, postal_code: e.target.value }))}
            required
          />

          <label className="field-label">Detail / Special Instructions</label>
          <textarea
            className="field-input"
            name="detail"
            placeholder="Additional delivery details or landmark"
            rows="3"
            value={addressFields.detail}
            onChange={(e) => setAddressFields((prev) => ({ ...prev, detail: e.target.value }))}
          />

          <label className="field-label">Avatar URL</label>
          <input className="field-input" name="avatar_url" value={profile.avatar_url} onChange={handleChange} />

          <label className="field-label">Bio</label>
          <textarea className="field-input" rows="4" name="bio" value={profile.bio} onChange={handleChange} />

          {message ? <div className="auth-alert auth-alert-success">{message}</div> : null}
          {error ? <div className="auth-alert">{error}</div> : null}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default ProfilePage;
