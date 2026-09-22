export type IpoStatus = "upcoming" | "open" | "closing_today" | "closed" | "allotted" | "listed";

export type IpoCategory = "retail" | "sHNI" | "bHNI";

export interface Ipo {
  id: string;
  name: string;
  company: string;
  status: IpoStatus;
  openDate: string;
  closeDate: string;
  allotmentDate: string;
  listingDate: string;
  refundDate: string;
  priceMin: number;
  priceMax: number;
  lotSize: number;                  // shares per lot
  retailMinAmount: number;          // 1 lot × price
  sHniMinAmount: number;            // 15 lots × price (sHNI threshold ≥2L)
  bHniMinAmount: number;            // 70 lots × price (bHNI threshold ≥10L)
  score: number;                    // 0–100 AI score
  gmp: number | null;               // grey market premium %
  subscriptionRate: number | null;  // current overall subscription
  industry: string;
  drhpUrl: string | null;
  redFlags: string[];
  recommendation: "apply" | "avoid" | "watch";
}
