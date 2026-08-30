// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PaymentStatusRefresh } from "../components/payment-status-refresh";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<PaymentStatusRefresh />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("refreshes server status without claiming the payment succeeded", async () => {
  expect(router.refresh).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(3000));
  expect(router.refresh).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain(
    "Checking your payment automatically",
  );
  expect(container.textContent).not.toContain("Payment confirmed");
});
it("bounds automatic checks and preserves manual recovery", async () => {
  for (let count = 0; count < 15; count++) {
    await act(async () => vi.advanceTimersByTime(3000));
  }
  expect(router.refresh).toHaveBeenCalledTimes(12);
  expect(container.textContent).toContain("Refresh payment status");
  expect(container.textContent).toContain("please do not pay again");
});
it("stops polling when the server renders a confirmed or stopped state", async () => {
  await act(async () => root.render(null));
  await act(async () => vi.advanceTimersByTime(60000));
  expect(router.refresh).not.toHaveBeenCalled();
});
