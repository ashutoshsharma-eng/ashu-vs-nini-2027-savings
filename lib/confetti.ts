import confetti from "canvas-confetti";

export function celebrateTick() {
  void confetti({
    particleCount: 40,
    spread: 55,
    startVelocity: 28,
    scalar: 0.8,
    ticks: 120,
    origin: { y: 0.75 },
    disableForReducedMotion: true,
  });
}

export function celebrateMilestone() {
  const base = { disableForReducedMotion: true, ticks: 220, startVelocity: 45, spread: 70 };
  void confetti({ ...base, particleCount: 90, angle: 60, origin: { x: 0, y: 0.8 } });
  void confetti({ ...base, particleCount: 90, angle: 120, origin: { x: 1, y: 0.8 } });
}
