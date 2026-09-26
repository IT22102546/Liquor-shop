"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "./constants";
import { readApiData } from "./api";

/** Shop feature switches (see backend settings.service). Everything is off until an admin turns it on. */
export type ShopSettings = {
  loyaltyRedemptionEnabled: boolean;
  /** Members earn 1 point for every this-many rupees they pay. */
  loyaltyRupeesPerPoint: number;
  /** Rupees taken off the bill for each point a member spends. */
  loyaltyPointValue: number;
  discountsEnabled: boolean;
  maxCashierDiscountPercent: number;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  loyaltyRedemptionEnabled: false,
  loyaltyRupeesPerPoint: 100,
  loyaltyPointValue: 1,
  discountsEnabled: false,
  maxCashierDiscountPercent: 10,
};

const settingsKey = (token: string) => ["pos", "shop-settings", token];

export function useShopSettings(token: string) {
  const query = useQuery({
    queryKey: settingsKey(token),
    enabled: Boolean(token),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/pos/settings`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      return readApiData<ShopSettings>(response, "Failed to load shop settings");
    },
  });
  return { settings: query.data ?? DEFAULT_SHOP_SETTINGS, loaded: query.isSuccess, error: query.error };
}

export function useSaveShopSettings(token: string) {
  const queryClient = useQueryClient();
  return async (changes: Partial<ShopSettings>) => {
    const response = await fetch(`${API_URL}/api/pos/settings`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const saved = await readApiData<ShopSettings>(response, "Could not save the setting");
    queryClient.setQueryData(settingsKey(token), saved);
    return saved;
  };
}
