"use client";

import { Toaster } from "sonner";
import { useEffect } from "react";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { CartProvider } from "@/components/cart-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);

  return (
    <ConvexClientProvider>
      <CartProvider>
        {children}
        <Toaster
          closeButton
          position="bottom-center"
          toastOptions={{ className: "gallery-toast" }}
        />
      </CartProvider>
    </ConvexClientProvider>
  );
}
