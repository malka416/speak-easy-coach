import { useEffect, useState } from "react";

const KEY = "speakeasy.devMode";

export function getDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setDevMode(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("devmode-change"));
}

export function useDevMode(): boolean {
  const [on, setOn] = useState<boolean>(() => getDevMode());
  useEffect(() => {
    const handler = () => setOn(getDevMode());
    window.addEventListener("devmode-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("devmode-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return on;
}