import { useMemo } from "react";

export interface SalesCalculation {
  sellingPrice: number;
  commissionPercentage: number;
  shop_profit: number;
  seller_payout: number;
}

/**
 * Custom React hook that calculates shop_profit and seller_payout in real-time
 * whenever the Selling Price or Commission % is adjusted.
 */
export function useSalesCalculation(
  sellingPriceInput: number | string,
  commissionPercentageInput: number | string
): SalesCalculation {
  return useMemo(() => {
    const rawPrice =
      typeof sellingPriceInput === "string"
        ? parseFloat(sellingPriceInput)
        : sellingPriceInput;
    const rawCommission =
      typeof commissionPercentageInput === "string"
        ? parseFloat(commissionPercentageInput)
        : commissionPercentageInput;

    const sellingPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;
    const commissionPercentage =
      isNaN(rawCommission) || rawCommission < 0 ? 0 : rawCommission;

    // shop_profit = (selling_price * commission_percentage) / 100
    const shop_profit = Number(
      ((sellingPrice * commissionPercentage) / 100).toFixed(2)
    );

    // seller_payout = selling_price - shop_profit
    const seller_payout = Number((sellingPrice - shop_profit).toFixed(2));

    return {
      sellingPrice,
      commissionPercentage,
      shop_profit,
      seller_payout,
    };
  }, [sellingPriceInput, commissionPercentageInput]);
}
