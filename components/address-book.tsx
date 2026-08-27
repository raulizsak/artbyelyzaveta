"use client";

import { useState } from "react";
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

const empty = {
  label: "Home",
  recipient_name: "",
  line1: "",
  line2: "",
  suburb: "",
  state: "VIC",
  postcode: "",
  country: "Australia",
};

export function AddressBook({ initial }: { initial: Address[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const { error: saveError } = await createClient().rpc("save_my_address", {
      // PostgreSQL function arguments are nullable, but generated
      // PostgREST types cannot represent argument nullability.
      p_id: editingId as unknown as string,
      p_label: form.label,
      p_recipient_name: form.recipient_name,
      p_line1: form.line1,
      p_line2: form.line2,
      p_suburb: form.suburb,
      p_state: form.state,
      p_postcode: form.postcode,
      p_country: form.country,
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
    }
    setSaving(false);
  }

  async function remove(id: string) {
    setError("");
    const { error: deleteError } = await createClient().rpc(
      "delete_my_address",
      { p_id: id },
    );
    if (deleteError) {
      setError("We couldn't remove that address.");
    } else {
      if (editingId === id) cancelEdit();
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
      p_country: address.country,
      p_is_default: true,
    });
    if (saveError) setError("We couldn't change your default address.");
    else await refresh();
  }

  function edit(address: Address) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      recipient_name: address.recipient_name,
      line1: address.line1,
      line2: address.line2 ?? "",
      suburb: address.suburb,
      state: address.state,
      postcode: address.postcode,
      country: address.country,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
  }

  return (
    <section className="account-panel">
      <p className="eyebrow">Addresses</p>
      <h1>Delivery addresses</h1>
      <div className="address-grid">
        {addresses.map((address) => (
          <article key={address.id}>
            <strong>
              {address.label}
              {address.is_default ? " · Default" : ""}
            </strong>
            <address>
              {address.recipient_name}
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
              {address.country}
            </address>
            <div className="button-row">
              <button
                className="text-button"
                onClick={() => edit(address)}
                type="button"
              >
                Edit
              </button>
              {!address.is_default ? (
                <button
                  className="text-button"
                  onClick={() => makeDefault(address)}
                  type="button"
                >
                  Make default
                </button>
              ) : null}
              <button
                className="text-button"
                onClick={() => remove(address.id)}
                type="button"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={save}>
        <h2>{editingId ? "Edit address" : "Add an address"}</h2>
        <fieldset disabled={saving}>
          <div className="form-grid two-col">
            {Object.entries(form).map(([key, value]) => (
              <label className="form-field" key={key}>
                <span>{key.replaceAll("_", " ")}</span>
                <input
                  maxLength={key === "postcode" ? 20 : 200}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                  required={key !== "line2"}
                  value={value}
                />
              </label>
            ))}
          </div>
          <div className="button-row">
            <button className="primary-action" type="submit">
              {saving ? "Saving…" : "Save address"}
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
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </section>
  );
}
