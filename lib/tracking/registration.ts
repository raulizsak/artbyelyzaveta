import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  normalizeTrackingNumber,
  registerAustraliaPostTracking,
  stopAustraliaPostTracking,
} from "@/supabase/functions/tracking-webhook/seventeen-track";

type Claim = {
  claimed?: boolean;
  reason?: string;
  tracking_number?: string;
  previous_tracking_number?: string | null;
  previous_carrier_code?: number | null;
};

type Completion = {
  completed?: boolean;
  reason?: string;
  registered?: boolean;
};

export type TrackingRegistrationOutcome = {
  attempted: boolean;
  registered: boolean;
  message: string | null;
};

export async function registerOrderTracking({
  orderId,
  supabase,
  fetcher = fetch,
  apiKey = process.env["TRACK17_API_KEY"]?.trim() ?? "",
}: {
  orderId: string;
  supabase: SupabaseClient<Database>;
  fetcher?: typeof fetch;
  apiKey?: string;
}): Promise<TrackingRegistrationOutcome> {
  const { data: claimData, error: claimError } = await supabase.rpc(
    "admin_claim_tracking_registration",
    { p_order_id: orderId },
  );
  if (claimError)
    return {
      attempted: false,
      registered: false,
      message: "The order was saved, but automatic tracking could not start.",
    };

  const claim = (claimData ?? {}) as Claim;
  if (!claim.claimed) {
    if (claim.reason === "already_registered")
      return { attempted: false, registered: true, message: null };
    if (claim.reason === "in_progress")
      return {
        attempted: false,
        registered: false,
        message: "Automatic tracking registration is already in progress.",
      };
    if (claim.reason === "tracking_stopped")
      return {
        attempted: false,
        registered: false,
        message:
          "17TRACK has stopped this shipment. Correct the tracking number or use the manual Delivered action.",
      };
    return { attempted: false, registered: false, message: null };
  }

  const trackingNumber = normalizeTrackingNumber(claim.tracking_number);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const timedFetch: typeof fetch = (input, init) =>
    fetcher(input, { ...init, signal: controller.signal });
  const result = await registerAustraliaPostTracking(
    timedFetch,
    apiKey,
    trackingNumber,
  );
  clearTimeout(timeout);

  const { data: completionData, error: completionError } = await supabase.rpc(
    "admin_complete_tracking_registration",
    {
      p_order_id: orderId,
      p_tracking_number: trackingNumber,
      p_success: result.ok,
      p_error: result.error,
    },
  );
  const completion = (completionData ?? {}) as Completion;

  if (result.ok && completion.reason === "stale_tracking_number") {
    await stopAustraliaPostTracking(fetcher, apiKey, trackingNumber);
    return {
      attempted: true,
      registered: false,
      message:
        "The tracking number changed while registration was in progress.",
    };
  }

  if (completionError || !completion.completed)
    return {
      attempted: true,
      registered: false,
      message: "The order was saved, but tracking registration needs review.",
    };

  if (!result.ok)
    return {
      attempted: true,
      registered: false,
      message: result.error,
    };

  const previous = normalizeTrackingNumber(claim.previous_tracking_number);
  if (previous && previous !== trackingNumber)
    await stopAustraliaPostTracking(fetcher, apiKey, previous);

  return { attempted: true, registered: true, message: null };
}
