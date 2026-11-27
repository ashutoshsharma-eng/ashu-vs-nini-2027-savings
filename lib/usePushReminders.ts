"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disableRemindersAction,
  enableRemindersAction,
  getPushPublicKeyAction,
  sendTestReminderAction,
} from "@/app/actions";

export type ReminderStatus =
  | "checking"
  | "unsupported" // this browser can't do web push at all
  | "needs-install" // iPhone/iPad: only works from the Home Screen icon
  | "blocked" // the person said "Don't Allow"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export function usePushReminders() {
  const [status, setStatus] = useState<ReminderStatus>("checking");
  const [busy, setBusy] = useState(false);

  const detect = useCallback(async (): Promise<ReminderStatus> => {
    if (!pushSupported()) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
    if (Notification.permission === "denied") return "blocked";
    try {
      return (await currentSubscription()) ? "on" : "off";
    } catch {
      return "unsupported";
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void detect().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [detect]);

  /** Must be called straight from a tap — iOS only shows the permission prompt for user gestures. */
  const enable = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return "Notifications weren't allowed.";
      }
      const key = await getPushPublicKeyAction();
      if (!key) return "Please log in again.";
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await enableRemindersAction(sub.toJSON());
      if (!res.ok) return res.error;
      setStatus("on");
      return null;
    } catch (err) {
      console.error(err);
      return "Couldn't turn on reminders on this phone.";
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await disableRemindersAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      return null;
    } catch (err) {
      console.error(err);
      return "Couldn't turn off reminders.";
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const res = await sendTestReminderAction();
      return res.ok ? null : res.error;
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable, test };
}
