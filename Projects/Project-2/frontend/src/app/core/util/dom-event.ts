/**
 * `Event.target` is typed `EventTarget | null` by the DOM spec — no
 * generic parameter narrows it, so every native `(input)`/`(change)`
 * handler in this codebase used to reach for `event.target as
 * HTMLInputElement` (or, worse, `$any($event.target)` inline in a
 * template, which drops type-checking on the whole expression). These
 * are `instanceof` guards instead: a real runtime check standing in for
 * what the DOM API itself can't express statically, so the narrowing is
 * actually verified rather than merely asserted.
 */

/** The current value of the `<input>`/`<textarea>`/`<select>` that fired `event`, or '' if the target isn't one of those. */
export function inputValue(event: Event): string {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return target.value;
  }
  return '';
}

/** The checked state of the checkbox `<input>` that fired `event`, or false if the target isn't one. */
export function checkedValue(event: Event): boolean {
  return event.target instanceof HTMLInputElement && event.target.checked;
}

/** The first selected file from the file `<input>` that fired `event`, if any. */
export function firstSelectedFile(event: Event): File | undefined {
  return event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
}

/** Clears a file `<input>`'s value — lets selecting the exact same file again still fire `change`. No-op if the target isn't a file input. */
export function resetFileInput(event: Event): void {
  if (event.target instanceof HTMLInputElement) event.target.value = '';
}

/** The nearest ancestor `<form>` of the element that fired `event`, if any. */
export function closestForm(event: Event): HTMLFormElement | null {
  return event.target instanceof Element ? event.target.closest('form') : null;
}
