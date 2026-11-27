export type Member = {
  id: number;
  name: string;
  emoji: string;
  /** a key of MEMBER_COLORS */
  color: string;
  isAdmin: boolean;
  /** true while the member still uses a default PIN (1111/2222 from the original two-player setup) */
  pinIsDefault: boolean;
};

export type BoxRow = {
  id: number;
  memberId: number;
  amount: number;
  isChecked: boolean;
  /** ISO timestamp, or null when unticked */
  checkedAt: string | null;
};

export type MoneyDateRow = {
  id: number;
  weekIndex: number;
  /** YYYY-MM-DD */
  sundayDate: string;
  isCompleted: boolean;
  notes: string;
};

export type BucketItem = {
  id: number;
  memberId: number;
  title: string;
  estCost: number | null;
  isDone: boolean;
  createdAt: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
