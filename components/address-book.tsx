"use client";

import { useState } from "react";
import { Check, Edit3, MapPin, Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Address = {
  id: string;
  label: string;
  recipient_name: string;
  line1: string;
  line2: string | null;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  is_default: boolean;
};

type AddressForm = Omit<Address, "id" | "is_default" | "line2"> & {
  line2: string;
};

const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const suburbs = [
  "Adelaide",
  "Ballarat",
  "Bendigo",
  "Brisbane",
  "Byron Bay",
  "Canberra",
  "Carlton",
  "Darwin",
  "Fitzroy",
  "Footscray",
  "Geelong",
  "Gold Coast",
  "Hobart",
  "Launceston",
  "Melbourne",
  "Newcastle",
  "Northcote",
  "Parramatta",
  "Perth",
  "Richmond",
  "South Yarra",
  "St Kilda",
  "Sydney",
  "Wollongong",
];

const emptyAddress = (defaultRecipient: string): AddressForm => ({
  label: "Home",
  recipient_name: defaultRecipient,
  line1: "",
  line2: "",
  suburb: "",
  state: "VIC",
  postcode: "",
  country: "Australia",
});

export function AddressBook({
  initial,
  defaultRecipient,
}: {
  initial: Address[];
  defaultRecipient: string;
}) {
  const [addresses, setAddresses] = useState(initial);
  const [form, setForm] = useState(() => emptyAddress(defaultRecipient));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function update<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
    const { data } = await createClient()
      .from("customer_addresses")
      .select(
        "id, label, recipient_name, line1, line2, suburb, state, postcode, country, is_default",
      )
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (data) setAddresses(data as Address[]);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (!/^\d{4}$/.test(form.postcode)) {
      setError("Enter a valid four-digit Australian postcode.");
      return;
    }
    if (!states.includes(form.state)) {
      setError("Choose a valid Australian state or territory.");
      return;
    }
    setSaving(true);
    const { error: saveError } = await createClient().rpc("save_my_address", {
      p_id: editingId as unknown as string,
      p_label: form.label.trim(),
      p_recipient_name: form.recipient_name.trim(),
      p_line1: form.line1.trim(),
      p_line2: form.line2.trim(),
      p_suburb: form.suburb.trim(),
      p_state: form.state,
      p_postcode: form.postcode,
      p_country: "Australia",
      p_is_default: editingId
        ? Boolean(
            addresses.find((address) => address.id === editingId)?.is_default,
          )
        : addresses.length === 0,
    });
    if (saveError) {
      setError(
        "We couldn't save that address. Check each field and try again.",
      );
    } else {
      await refresh();
      cancelEdit();
      setSaved(true);
    }
    setSaving(false);
  }

  async function remove(id: string) {
    setError("");
    const { error: deleteError } = await createClient().rpc(
      "delete_my_address",
      {
        p_id: id,
      },
    );
    if (deleteError) setError("We couldn't remove that address.");
    else {
      if (editingId === id) cancelEdit();
      setRemovingId(null);
      await refresh();
    }
  }

  async function makeDefault(address: Address) {
    setError("");
    const { error: saveError } = await createClient().rpc("save_my_address", {
      p_id: address.id,
      p_label: address.label,
      p_recipient_name: address.recipient_name,
      p_line1: address.line1,
      p_line2: address.line2 ?? "",
      p_suburb: address.suburb,
      p_state: address.state,
      p_postcode: address.postcode,
      p_country: "Australia",
      p_is_default: true,
    });
    if (saveError) setError("We couldn't change your default address.");
    else await refresh();
  }

  function edit(address: Address) {
    setEditingId(address.id);
    setSaved(false);
    setForm({
      label: address.label,
      recipient_name: address.recipient_name,
      line1: address.line1,
      line2: address.line2 ?? "",
      suburb: address.suburb,
      state: address.state,
      postcode: address.postcode,
      country: "Australia",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyAddress(defaultRecipient));
  }

  return (
    <section className="account-panel address-book">
      <div className="panel-heading-with-icon">
        <MapPin aria-hidden="true" />
        <span>
          <p className="eyebrow">Addresses</p>
          <h1>Delivery addresses</h1>
        </span>
      </div>
      <p className="account-panel__intro">
        Australia-wide delivery details for original artwork and studio
        correspondence.
      </p>
      {addresses.length ? (
        <div className="address-grid address-card-grid">
          {addresses.map((address) => (
            <article
              className={address.is_default ? "address-card--default" : ""}
              key={address.id}
            >
              <header>
                <span>
                  <MapPin aria-hidden="true" size={17} />
                  <strong>{address.label}</strong>
                </span>
                {address.is_default ? (
                  <small>
                    <Star aria-hidden="true" size={13} /> Default
                  </small>
                ) : null}
              </header>
              <address>
                <strong>{address.recipient_name}</strong>
                <br />
                {address.line1}
                {address.line2 ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.suburb} {address.state} {address.postcode}
                <br />
                Australia
              </address>
              {removingId === address.id ? (
                <div className="address-delete-confirm" role="alert">
                  <p>Remove this saved address?</p>
                  <button
                    className="text-button text-button--danger"
                    onClick={() => void remove(address.id)}
                    type="button"
                  >
                    Yes, remove
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setRemovingId(null)}
                    type="button"
                  >
                    Keep it
                  </button>
                </div>
              ) : (
                <div className="address-card__actions">
                  <button
                    className="text-button"
                    onClick={() => edit(address)}
                    type="button"
                  >
                    <Edit3 aria-hidden="true" size={14} /> Edit
                  </button>
                  {!address.is_default ? (
                    <button
                      className="text-button"
                      onClick={() => void makeDefault(address)}
                      type="button"
                    >
                      <Star aria-hidden="true" size={14} /> Make default
                    </button>
                  ) : null}
                  <button
                    className="text-button"
                    onClick={() => setRemovingId(address.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={14} /> Remove
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <h2>No saved addresses yet</h2>
          <p>Your first address will become the default.</p>
        </div>
      )}
      <form className="address-form" onSubmit={save}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {editingId ? "Update details" : "New destination"}
            </p>
            <h2>{editingId ? "Edit address" : "Add an address"}</h2>
          </div>
        </div>
        <fieldset disabled={saving}>
          <legend className="sr-only">Australian delivery address</legend>
          <div className="form-grid two-col">
            <label className="form-field">
              <span>Address label</span>
              <input
                autoComplete="off"
                maxLength={50}
                onChange={(event) => update("label", event.target.value)}
                placeholder="Home or Work"
                required
                value={form.label}
              />
            </label>
            <label className="form-field">
              <span>Recipient name</span>
              <input
                autoComplete="name"
                maxLength={120}
                onChange={(event) =>
                  update("recipient_name", event.target.value)
                }
                required
                value={form.recipient_name}
              />
              <small className="neutral-helper">
                Pre-filled from your profile and editable when gifting.
              </small>
            </label>
            <label className="form-field form-field--wide">
              <span>Address line 1 *</span>
              <input
                autoComplete="address-line1"
                maxLength={200}
                onChange={(event) => update("line1", event.target.value)}
                placeholder="Street number and name"
                required
                value={form.line1}
              />
            </label>
            <label className="form-field form-field--wide">
              <span>
                Address line 2 <small>(optional)</small>
              </span>
              <input
                autoComplete="address-line2"
                maxLength={200}
                onChange={(event) => update("line2", event.target.value)}
                placeholder="Apartment, suite or building"
                value={form.line2}
              />
            </label>
            <label className="form-field">
              <span>Suburb *</span>
              <input
                autoComplete="address-level2"
                list="australian-suburbs"
                maxLength={100}
                onChange={(event) => update("suburb", event.target.value)}
                placeholder="Start typing a suburb"
                required
                value={form.suburb}
              />
              <datalist id="australian-suburbs">
                {suburbs.map((suburb) => (
                  <option key={suburb} value={suburb} />
                ))}
              </datalist>
            </label>
            <label className="form-field">
              <span>State *</span>
              <select
                autoComplete="address-level1"
                onChange={(event) => update("state", event.target.value)}
                required
                value={form.state}
              >
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Postcode *</span>
              <input
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={4}
                onChange={(event) =>
                  update("postcode", event.target.value.replace(/\D/g, ""))
                }
                pattern="[0-9]{4}"
                placeholder="3000"
                required
                value={form.postcode}
              />
            </label>
            <label className="form-field">
              <span>Country</span>
              <input aria-readonly="true" readOnly value="Australia" />
              <small className="neutral-helper">
                The shop currently delivers within Australia only.
              </small>
            </label>
          </div>
          <div className="button-row">
            <button className="primary-action" type="submit">
              {saving ? "Saving…" : editingId ? "Save changes" : "Save address"}
            </button>
            {editingId ? (
              <button
                className="secondary-action"
                onClick={cancelEdit}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </fieldset>
        {saved ? (
          <p className="form-success-inline" role="status">
            <Check aria-hidden="true" size={16} /> Address saved.
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
