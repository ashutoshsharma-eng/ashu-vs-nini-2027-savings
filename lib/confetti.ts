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

let emojiShapes: confetti.Shape[] | null = null;
function partyShapes(): confetti.Shape[] {
  if (!emojiShapes) {
    emojiShapes = ["🎉", "🥳", "🍾", "🎊", "🥂", "💰"].map((text) =>
      confetti.shapeFromText({ text, scalar: 2.2 }),
    );
  }
  return emojiShapes;
}

/** Party poppers from both bottom corners + an emoji shower, for ~2.5 seconds. */
export function celebrateMilestone() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const end = Date.now() + 2500;
  const colors = ["#0ea5e9", "#ec4899", "#f59e0b", "#10b981", "#a855f7"];

  // Big opening blast
  const blast = { particleCount: 120, spread: 75, startVelocity: 60, ticks: 260, colors };
  void confetti({ ...blast, angle: 60, origin: { x: 0, y: 1 } });
  void confetti({ ...blast, angle: 120, origin: { x: 1, y: 1 } });
  void confetti({
    particleCount: 30,
    spread: 100,
    startVelocity: 45,
    ticks: 300,
    scalar: 2.2,
    shapes: partyShapes(),
    origin: { x: 0.5, y: 0.7 },
  });

  // Keep the poppers going
  (function frame() {
    void confetti({ particleCount: 6, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.9 }, colors });
    void confetti({ particleCount: 6, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.9 }, colors });
    if (Math.random() < 0.25) {
      void confetti({
        particleCount: 2,
        spread: 120,
        startVelocity: 35,
        scalar: 2.2,
        shapes: partyShapes(),
        origin: { x: Math.random(), y: 0.2 },
        gravity: 0.8,
      });
    }
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
