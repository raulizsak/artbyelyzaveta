"use client";

import { Dices, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  melbourneDateTimeLocalToIso,
  toMelbourneDateTimeLocal,
} from "@/lib/date-time";
import { formatDisplayValue } from "@/lib/presentation";

export type DiscountEditorPainting = {
  id: string;
  status: string;
  title: string;
};

export type DiscountEditorValue = {
  active: boolean;
  amountOffAud: string;
  appliesTo: "all" | "specific";
  code: string;
  combinable: boolean;
  discountType: "percentage" | "fixed_amount";
  endsAt: string;
  id?: string;
  maxRedemptions: string;
  minimumSubtotalAud: string;
  oneUsePerCustomer: boolean;
  paintingIds: string[];
  percentOff: string;
  startsAt: string;
};

const blank: DiscountEditorValue = {
  active: true,
  amountOffAud: "",
  appliesTo: "all",
  code: "",
  combinable: false,
  discountType: "percentage",
  endsAt: "",
  maxRedemptions: "",
  minimumSubtotalAud: "",
  oneUsePerCustomer: false,
  paintingIds: [],
  percentOff: "10",
  startsAt: toMelbourneDateTimeLocal(Date.now()),
};

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `ART${Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("")}`;
}

export function DiscountEditor({
  initial = blank,
  paintings,
}: {
  initial?: DiscountEditorValue;
  paintings: DiscountEditorPainting[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filteredPaintings = useMemo(
    () =>
      paintings.filter((painting) =>
        painting.title.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [paintings, search],
  );

  const update = <K extends keyof DiscountEditorValue>(
    key: K,
    value: DiscountEditorValue[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  function togglePainting(id: string) {
    update(
      "paintingIds",
      form.paintingIds.includes(id)
        ? form.paintingIds.filter((paintingId) => paintingId !== id)
        : [...form.paintingIds, id],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        form.id ? `/api/admin/discounts/${form.id}` : "/api/admin/discounts",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            active: form.active,
            amountOffAud: form.amountOffAud || null,
            appliesTo: form.appliesTo,
            code: form.code,
            combinable: form.combinable,
            discountType: form.discountType,
            endsAt: form.endsAt
              ? melbourneDateTimeLocalToIso(form.endsAt)
              : null,
            maxRedemptions: form.maxRedemptions
              ? Number(form.maxRedemptions)
              : null,
            minimumSubtotalAud: form.minimumSubtotalAud || null,
            oneUsePerCustomer: form.oneUsePerCustomer,
            paintingIds: form.paintingIds,
            percentOff: form.percentOff ? Number(form.percentOff) : null,
            startsAt: melbourneDateTimeLocalToIso(form.startsAt),
          }),
        },
      );
      const data = (await response.json()) as { error?: string; id?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error || "Discount could not be saved.");
      router.replace(`/admin/discounts/${data.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discount could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!form.id || !window.confirm("Archive this discount? Historical orders will be preserved."))
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/discounts/${form.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Discount could not be archived.");
      }
      router.replace("/admin/discounts");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discount could not be archived.");
      setBusy(false);
    }
  }

  return (
    <form className="discount-editor" onSubmit={submit}>
      <header className="painting-editor__heading">
        <div>
          <p className="eyebrow">Promotion editor</p>
          <h1>{form.id ? `Edit ${form.code}` : "Create discount"}</h1>
          <p>Configure the customer offer once; the shop remains the pricing authority.</p>
        </div>
        <button className="primary-action" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save discount"}
        </button>
      </header>

      <section className="painting-editor__section">
        <header><h2>Discount code</h2><p>Codes are case-insensitive for customers and saved in uppercase.</p></header>
        <div className="discount-code-field">
          <label className="form-field"><span>Code</span><input autoCapitalize="characters" onChange={(event) => update("code", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="WELCOME10" required value={form.code} /></label>
          <button className="secondary-action" onClick={() => update("code", generateCode())} type="button"><Dices size={17} /> Generate</button>
        </div>
      </section>

      <section className="painting-editor__section">
        <header><h2>Value</h2><p>Normal discounts apply only to the artwork subtotal; shipping remains separate.</p></header>
        <div className="discount-segmented">
          <button aria-pressed={form.discountType === "percentage"} onClick={() => update("discountType", "percentage")} type="button">Percentage</button>
          <button aria-pressed={form.discountType === "fixed_amount"} onClick={() => update("discountType", "fixed_amount")} type="button">Fixed amount</button>
        </div>
        {form.discountType === "percentage" ? <label className="form-field"><span>Percentage off</span><div className="money-input"><input max="100" min="0.01" onChange={(event) => update("percentOff", event.target.value)} required step="0.01" type="number" value={form.percentOff} /><span>%</span></div></label> : <label className="form-field"><span>Amount off (AUD)</span><div className="money-input"><span>$</span><input inputMode="decimal" onChange={(event) => update("amountOffAud", event.target.value)} placeholder="100.00" required value={form.amountOffAud} /></div></label>}
      </section>

      <section className="painting-editor__section">
        <header><h2>Eligibility</h2><p>Apply the code to every painting or select individual works.</p></header>
        <div className="discount-segmented"><button aria-pressed={form.appliesTo === "all"} onClick={() => update("appliesTo", "all")} type="button">All paintings</button><button aria-pressed={form.appliesTo === "specific"} onClick={() => update("appliesTo", "specific")} type="button">Specific paintings</button></div>
        {form.appliesTo === "specific" ? <div className="discount-product-picker"><label className="admin-topbar__search"><Search size={17} /><input onChange={(event) => setSearch(event.target.value)} placeholder="Search paintings" value={search} /></label><div>{filteredPaintings.map((painting) => <label className="consent-field" key={painting.id}><input checked={form.paintingIds.includes(painting.id)} onChange={() => togglePainting(painting.id)} type="checkbox" /><span><strong>{painting.title}</strong><small>{formatDisplayValue(painting.status)}</small></span></label>)}</div></div> : null}
      </section>

      <section className="painting-editor__section">
        <header><h2>Dates & limits</h2><p>Times are entered and displayed in Melbourne time.</p></header>
        <div className="form-grid two-col"><label className="form-field"><span>Start date and time</span><input onChange={(event) => update("startsAt", event.target.value)} required type="datetime-local" value={form.startsAt} /></label><label className="form-field"><span>End date and time (optional)</span><input onChange={(event) => update("endsAt", event.target.value)} type="datetime-local" value={form.endsAt} /></label><label className="form-field"><span>Maximum total uses (optional)</span><input min="1" onChange={(event) => update("maxRedemptions", event.target.value)} placeholder="Unlimited" type="number" value={form.maxRedemptions} /></label><label className="form-field"><span>Minimum artwork subtotal (AUD)</span><div className="money-input"><span>$</span><input inputMode="decimal" onChange={(event) => update("minimumSubtotalAud", event.target.value)} placeholder="No minimum" value={form.minimumSubtotalAud} /></div></label></div>
        <div className="editor-checks"><label className="consent-field"><input checked={form.oneUsePerCustomer} onChange={(event) => update("oneUsePerCustomer", event.target.checked)} type="checkbox" /><span>One use per customer email</span></label><label className="consent-field"><input checked={form.combinable} onChange={(event) => update("combinable", event.target.checked)} type="checkbox" /><span>Can combine with other combinable codes</span></label><label className="consent-field"><input checked={form.active} onChange={(event) => update("active", event.target.checked)} type="checkbox" /><span>Active</span></label></div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      <footer className="discount-editor__footer">
        {form.id ? <button className="danger-action" disabled={busy} onClick={() => void archive()} type="button"><Trash2 size={16} /> Archive discount</button> : <span />}
        <button className="primary-action" disabled={busy} type="submit">{busy ? "Saving…" : "Save discount"}</button>
      </footer>
    </form>
  );
}
