/** The shared savings plan: box i (1-based) is worth start + (i - 1) × step. */
export type Plan = {
  start: number;
  step: number;
  count: number;
  /** false until someone has set the plan up in the app */
  configured: boolean;
  /** member id of whoever last saved the plan */
  updatedBy: number | null;
};

export const DEFAULT_PLAN = { start: 100, step: 100, count: 52 } as const;

export const PLAN_LIMITS = {
  minAmount: 1,
  maxAmount: 1_00_000,
  minBoxes: 4,
  maxBoxes: 200,
  maxBox: 10_00_000,
} as const;

export const START_SUGGESTIONS = [10, 50, 100, 200, 500];
export const STEP_SUGGESTIONS = [10, 50, 100, 200, 500];
export const COUNT_SUGGESTIONS = [26, 52, 104];

export const WEEKS_IN_YEAR = 52;

export function boxAmount(plan: Pick<Plan, "start" | "step">, i: number): number {
  return plan.start + (i - 1) * plan.step;
}

export function planAmounts(plan: Pick<Plan, "start" | "step" | "count">): number[] {
  return Array.from({ length: plan.count }, (_, i) => boxAmount(plan, i + 1));
}

export function lastBox(plan: Pick<Plan, "start" | "step" | "count">): number {
  return boxAmount(plan, plan.count);
}

/** Total one person saves by ticking every box. */
export function planTarget(plan: Pick<Plan, "start" | "step" | "count">): number {
  return plan.count * plan.start + (plan.step * plan.count * (plan.count - 1)) / 2;
}

export function validatePlan(start: number, step: number, count: number): string | null {
  const { minAmount, maxAmount, minBoxes, maxBoxes, maxBox } = PLAN_LIMITS;
  if (![start, step, count].every(Number.isInteger)) return "Use whole numbers only.";
  if (start < minAmount || start > maxAmount) return "Starting amount must be between ₹1 and ₹1,00,000.";
  if (step < minAmount || step > maxAmount) return "Step must be between ₹1 and ₹1,00,000.";
  if (count < minBoxes || count > maxBoxes) return `Number of boxes must be between ${minBoxes} and ${maxBoxes}.`;
  if (start + (count - 1) * step > maxBox) return "The biggest box would be over ₹10,00,000 — try smaller amounts.";
  return null;
}
