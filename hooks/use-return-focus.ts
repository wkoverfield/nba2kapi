import { useCallback, useState } from "react";

/**
 * Focus restoration for a controlled Radix dialog that has no Dialog.Trigger.
 *
 * Radix returns focus to its trigger element on close. A dialog opened from
 * state has no trigger, so focus falls to <body> and a keyboard user restarts
 * from the top of the page. This remembers the element that had focus when
 * `open` turned true and returns a handler for Dialog.Content's
 * `onCloseAutoFocus` that sends focus back to it.
 *
 * The element is read during render because an `autoFocus` input inside the
 * dialog takes focus in the same commit, before any effect could read it.
 */
export function useReturnFocus(open: boolean) {
  const [wasOpen, setWasOpen] = useState(open);
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const active = document.activeElement;
      setOpener(active instanceof HTMLElement && active !== document.body ? active : null);
    }
  }

  return useCallback(
    (event: Event) => {
      if (!opener || !opener.isConnected) return;
      event.preventDefault();
      opener.focus();
    },
    [opener]
  );
}
