import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const emptyProfile = {
  full_name: "",
  phone: "",
  address: "",
  bio: "",
  avatar_url: "",
  email: "",
  username: "",
  store_name: "",
  is_seller: false,
};

function ProfilePage({ onBecomeSeller }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
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
  const [sellerStoreName, setSellerStoreName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("http://127.0.0.1:8000/api/profile/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load profile");
        }

        const data = await response.json();
        setProfile((current) => ({ ...current, ...data, email: data.email || "" }));
        setSellerStoreName(data.store_name || "");

        // Try parsing address JSON
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
        } catch (e) {
          // If address is not valid JSON (e.g. legacy text), load it into address1
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
  }, [token]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
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
      const response = await fetch("http://127.0.0.1:8000/api/profile/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  const handleBecomeSeller = async (event) => {
    event.preventDefault();

    if (!sellerStoreName.trim()) {
      setError("Store name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/profile/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...profile,
          store_name: sellerStoreName,
          is_seller: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to upgrade to seller");
      }

      const data = await response.json();
      setProfile((current) => ({ ...current, ...data, store_name: sellerStoreName, is_seller: true }));
      localStorage.setItem("sellerStoreName", sellerStoreName);
      setMessage("You are now a seller.");
      if (onBecomeSeller) {
        onBecomeSeller(sellerStoreName);
      }
      navigate("/products");
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
          <p className="subtext">Edit your contact information, bio, and public seller details.</p>

          <div className="profile-avatar">{(profile.username || "U").slice(0, 1).toUpperCase()}</div>

          {!profile.is_seller && (
            <div className="seller-upgrade-box">
              <p className="eyebrow">Want to become seller?</p>
              <p className="subtext">Add your store name and start managing your own products.</p>
              {!sellerMode ? (
                <button type="button" className="btn btn-primary" onClick={() => setSellerMode(true)}>
                  Become Seller
                </button>
              ) : (
                <form className="seller-upgrade-form" onSubmit={handleBecomeSeller}>
                  <label className="field-label">Store Name</label>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="Enter store name"
                    value={sellerStoreName}
                    onChange={(e) => setSellerStoreName(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Updating..." : "Activate Seller"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setSellerMode(false)}>
                    Cancel
                  </button>
                </form>
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
            onChange={(e) => setAddressFields(prev => ({ ...prev, address1: e.target.value }))} 
            required
          />

          <label className="field-label">Address Line 2</label>
          <input 
            className="field-input" 
            name="address2" 
            placeholder="Street, area, colony name"
            value={addressFields.address2} 
            onChange={(e) => setAddressFields(prev => ({ ...prev, address2: e.target.value }))} 
          />

          <label className="field-label">Address Line 3</label>
          <input 
            className="field-input" 
            name="address3" 
            placeholder="Landmark, city, state"
            value={addressFields.address3} 
            onChange={(e) => setAddressFields(prev => ({ ...prev, address3: e.target.value }))} 
          />

          <label className="field-label">Postal / Zip Code</label>
          <input 
            className="field-input" 
            name="postal_code" 
            placeholder="Enter postal / zip code"
            value={addressFields.postal_code} 
            onChange={(e) => setAddressFields(prev => ({ ...prev, postal_code: e.target.value }))} 
            required
          />

          <label className="field-label">Detail / Special Instructions</label>
          <textarea 
            className="field-input" 
            name="detail" 
            placeholder="Additional delivery details or landmark"
            rows="3"
            value={addressFields.detail} 
            onChange={(e) => setAddressFields(prev => ({ ...prev, detail: e.target.value }))} 
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
