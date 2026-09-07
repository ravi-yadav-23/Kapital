// IPO scoring weights — must sum to 100
export const SCORE_WEIGHTS = {
  financialQuality:    25,   // Claude: revenue growth, margins, debt, promoter holding
  gmpSignal:           20,   // Grey market premium (Gemini news fetch)
  subscriptionHype:    20,   // Expected subscription rate (industry + news signal)
  allotmentProbability:15,   // Category-adjusted chance (sHNI vs retail vs bHNI)
  industryTrend:       10,   // Sector momentum
  lockInConflict:      10,   // Penalty if our funds are blocked during open window
} as const;

// Category thresholds (Angel One ASBA)
export const CATEGORY_THRESHOLDS = {
  retail: { minLots: 1, maxAmount: 200000 },        // ≤ ₹2L
  sHNI:   { minLots: 15, minAmount: 200001, maxAmount: 1000000 },  // ₹2L–₹10L
  bHNI:   { minLots: 70, minAmount: 1000001 },      // > ₹10L
} as const;
