// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StripePaymentPanel,
  type CheckoutRequest,
} from "../components/payment-panel";

const mocks = vi.hoisted(() => ({
  checkout: vi.fn(),
  confirm: vi.fn(),
  push: vi.fn(),
  loadStripe: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: mocks.loadStripe }));
vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children }: { children: ReactNode }) => children,
  PaymentElement: () => <div>Stripe payment fields</div>,
  useCheckoutElements: mocks.checkout,
}));

const request: CheckoutRequest = {
  paintingIds: ["test-painting"],
  discountCodes: [],
  firstName: "Sandbox",
  lastName: "Verification",
  email: "checkout@example.com",
  phone: "0400000000",
  delivery: "collection",
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  country: "Australia",
  notes: "",
};

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let stripeTotal: {
  amount: string;
  minorUnitsAmount: number;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  stripeTotal = { amount: "A$340.00", minorUnitsAmount: 34000 };
  mocks.checkout.mockReturnValue({
    type: "success",
    checkout: {
      total: { total: stripeTotal },
      currency: "aud",
      status: { type: "open" },
      confirm: mocks.confirm,
    },
  });
  mocks.confirm.mockResolvedValue({ type: "success" });
  mocks.loadStripe.mockResolvedValue({});
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      clientSecret: "test-only-client-secret",
      sessionId: "cs_test_regression",
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function button(label: string) {
  const found = Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

async function renderPanel(mode: "test" | "live" = "test") {
  await act(async () => {
    root.render(
      <StripePaymentPanel
        amount={34000}
        currency="AUD"
        enabled
        mode={mode}
        publishableKey={`pk_${mode}_regression`}
        request={request}
      />,
    );
  });
}

async function prepare(mode: "test" | "live" = "test") {
  await renderPanel(mode);
  await act(async () => button("Continue to").click());
}

describe("embedded Stripe payment", () => {
  it("reads and displays Stripe's reactive total before confirming", async () => {
    const readTotal = vi.fn(() => "A$340.00");
    Object.defineProperty(stripeTotal, "amount", { get: readTotal });
    mocks.confirm.mockImplementation(async () => {
      // The real Stripe SDK rejects confirmation if its total wasn't read.
      expect(readTotal).toHaveBeenCalled();
      expect(container.textContent).toContain("Total to pay: A$340.00");
      return { type: "success" };
    });
    await prepare();
    await act(async () => button("Pay securely").click());
    expect(mocks.confirm).toHaveBeenCalledWith({
      email: request.email,
      redirect: "if_required",
      returnUrl: `${window.location.origin}/order-confirmation?session_id=cs_test_regression`,
    });
    expect(mocks.push).toHaveBeenCalledWith(
      "/order-confirmation?session_id=cs_test_regression",
    );
    expect(button("Opening confirmation").disabled).toBe(true);
  });

  it.each(["throw", "reject"])(
    "recovers from a Stripe %s without claiming the payment failed",
    async (failure) => {
      if (failure === "throw") {
        mocks.confirm.mockImplementation(() => {
          throw new Error("Stripe integration error");
        });
      } else {
        mocks.confirm.mockRejectedValue(new Error("Network interrupted"));
      }
      await prepare();
      await act(async () => button("Pay securely").click());
      expect(container.textContent).not.toContain("Confirming…");
      expect(button("Pay securely").disabled).toBe(false);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "check your order status before trying again",
      );
      expect(
        container.querySelector('a[href*="session_id="]')?.textContent,
      ).toBe("Check order status");
      expect(mocks.push).not.toHaveBeenCalled();
    },
  );

  it("shows Stripe's card error and permits correction and retry", async () => {
    mocks.confirm.mockResolvedValueOnce({
      type: "error",
      error: { message: "Your card was declined." },
    });
    await prepare();
    await act(async () => button("Pay securely").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Your card was declined.",
    );
    expect(button("Pay securely").disabled).toBe(false);
    await act(async () => button("Pay securely").click());
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate clicks and explains a slow confirmation", async () => {
    vi.useFakeTimers();
    let finish!: (result: unknown) => void;
    mocks.confirm.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await prepare();
    const pay = button("Pay securely");
    await act(async () => {
      pay.click();
      pay.click();
    });
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(15000));
    expect(container.textContent).toContain(
      "Stripe is taking longer than usual",
    );
    expect(button("Confirming").disabled).toBe(true);
    await act(async () => finish({ type: "success" }));
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("taking longer");
  });

  it.each(["amount", "currency"])(
    "blocks payment if Stripe's %s disagrees with the quote",
    async (mismatch) => {
      if (mismatch === "amount") stripeTotal.minorUnitsAmount = 35000;
      if (mismatch === "currency") {
        const current = mocks.checkout();
        current.checkout.currency = "usd";
      }
      await prepare();
      expect(button("Pay securely").disabled).toBe(true);
      expect(container.textContent).toContain("payment total has changed");
      expect(mocks.confirm).not.toHaveBeenCalled();
    },
  );

  it("explains expired sessions instead of accepting another payment", async () => {
    mocks.checkout().checkout.status.type = "expired";
    await prepare();
    expect(button("Pay securely").disabled).toBe(true);
    expect(container.textContent).toContain("payment session has expired");
  });

  it("shows provider loading and failure states", async () => {
    mocks.checkout.mockReturnValue({ type: "loading" });
    await prepare();
    expect(container.textContent).toContain("Loading secure payment");
    expect(button("Pay securely").disabled).toBe(true);
    mocks.checkout.mockReturnValue({
      type: "error",
      error: { message: "This payment session could not be loaded." },
    });
    await renderPanel();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This payment session could not be loaded.",
    );
    expect(button("Pay securely").disabled).toBe(true);
  });

  it.each(["network", "json", "stripe"])(
    "recovers from a %s failure while preparing payment",
    async (failure) => {
      if (failure === "network")
        fetchMock.mockRejectedValue(new Error("Offline"));
      if (failure === "json")
        fetchMock.mockResolvedValue({
          ok: false,
          json: async () => {
            throw new Error("Not JSON");
          },
        });
      if (failure === "stripe") mocks.loadStripe.mockResolvedValue(null);
      await prepare();
      expect(container.textContent).not.toContain("Reserving artwork");
      expect(button("Continue to").disabled).toBe(false);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "No payment has been submitted",
      );
      expect(mocks.confirm).not.toHaveBeenCalled();
    },
  );

  it("uses the same confirmation path in live mode without test-card advice", async () => {
    await prepare("live");
    expect(container.textContent).not.toContain("4242");
    expect(container.textContent).not.toContain("test mode");
    await act(async () => button("Pay securely").click());
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });
});
