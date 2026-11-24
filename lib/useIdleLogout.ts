"use client";

import { useEffect, useRef, useState } from "react";
import { idleLogoutAction, touchSessionAction } from "@/app/actions";
import { IDLE_LIMIT_MS } from "./constants";

const WARN_BEFORE_MS = 30_000;
const TOUCH_EVERY_MS = 60_000;
const CHECK_EVERY_MS = 1_000;

/**
 * Logs the user out after IDLE_LIMIT_MS without interaction.
 * Returns seconds left once inside the warning window (else null), plus a way to stay signed in.
 */
export function useIdleLogout() {
  const lastActivity = useRef(0);
  const lastTouch = useRef(0);
  const loggingOut = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    lastActivity.current = Date.now();
    lastTouch.current = Date.now();

    const logout = () => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      void idleLogoutAction();
    };

    const check = () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        logout();
        return true;
      }
      const left = IDLE_LIMIT_MS - idle;
      setSecondsLeft(left <= WARN_BEFORE_MS ? Math.ceil(left / 1000) : null);
      return false;
    };

    const onActivity = () => {
      if (loggingOut.current) return;
      // If the phone slept past the limit, the first tap should not revive the session.
      if (check()) return;
      lastActivity.current = Date.now();
      setSecondsLeft(null);
      if (Date.now() - lastTouch.current > TOUCH_EVERY_MS) {
        lastTouch.current = Date.now();
        void touchSessionAction();
      }
    };

    // Coming back to the app is not activity by itself — just re-check the clock.
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    const events = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisibility);
    const id = window.setInterval(check, CHECK_EVERY_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
    };
  }, []);

  return { secondsLeft };
}
