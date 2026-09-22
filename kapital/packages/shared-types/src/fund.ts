import type { IpoCategory } from "./ipo";

export interface AllocationPlan {
  ipoId: string;
  ipoName: string;
  totalAllocated: number;
  allocations: AccountAllocation[];
}

export interface AccountAllocation {
  accountId: string;
  accountName: string;
  category: IpoCategory;
  lots: number;
  amount: number;
  rationale: string;
}

export interface FundSnapshot {
  totalFunds: number;
  availableFunds: number;
  blockedFunds: number;
  blockedUntil: BlockedFund[];
}

export interface BlockedFund {
  accountId: string;
  ipoId: string;
  ipoName: string;
  amount: number;
  releaseDate: string;       // ASBA refund date
}
