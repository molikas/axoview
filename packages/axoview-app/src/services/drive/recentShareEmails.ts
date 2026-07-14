// A local, per-browser memory of the email addresses this user has shared Drive
// diagrams with. It powers the "Add people" field's autocomplete WITHOUT any new
// Google scope: reading the user's actual Google Contacts would require the
// `contacts.readonly` (People API) scope — a sensitive scope that triggers Google
// verification and breaks the `drive.file`-only posture (ADR 0035). This is the
// user's own share history, stored client-side; nothing leaves the browser.

const STORAGE_KEY = 'axoview.recentShareEmails';
const MAX_ENTRIES = 20;

/** Most-recent-first list of previously shared-with emails (best-effort). */
export function getRecentShareEmails(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((e): e is string => typeof e === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Record an email at the front of the list (de-duplicated case-insensitively,
 *  capped). A no-op if localStorage is unavailable or the email is blank. */
export function addRecentShareEmail(email: string): void {
  const trimmed = email.trim();
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  try {
    const next = [
      trimmed,
      ...getRecentShareEmails().filter((e) => e.toLowerCase() !== lower)
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode / quota) — recents are best-effort.
  }
}
