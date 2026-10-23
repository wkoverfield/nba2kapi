"use client";

import { useSyncExternalStore } from "react";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";

/** Placeholder spellings used across docs and playground code samples. */
const KEY_PLACEHOLDER = /your_api_key_here|YOUR_API_KEY|YOUR_KEY/g;

function readKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * The API key saved in this browser (by the key dialog or dashboard), or null.
 * Null during server render and hydration, so markup matches.
 */
export function useStoredApiKey(): string | null {
  return useSyncExternalStore(subscribe, readKey, () => null);
}

/** Substitute the stored key for any placeholder in a code sample. */
export function fillApiKey(code: string, key: string | null): string {
  return key ? code.replace(KEY_PLACEHOLDER, key) : code;
}
