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
  monthIndex: number;
  monthLabel: string;
  sundayDate: string;
  isCompleted: boolean;
  notes: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
