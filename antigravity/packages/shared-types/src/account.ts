export interface FamilyAccount {
  id: string;
  name: string;                 // e.g. "Ravi", "Papa", "Mama"
  angelClientId: string;
  bankName: string;
  upiId: string | null;
  availableBalance: number;     // fetched from Angel One
  blockedAmount: number;        // currently in ASBA
  totalBalance: number;         // available + blocked
  isActive: boolean;
}
