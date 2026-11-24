import type { Player } from "./constants";

export type BoxRow = {
  id: number;
  player: Player;
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
  player: Player;
  title: string;
  estCost: number | null;
  isDone: boolean;
  createdAt: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
