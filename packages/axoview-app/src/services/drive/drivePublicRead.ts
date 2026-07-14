import { authStore } from '../../stores/authStore';
import { apiBaseUrl } from '../../utils/apiBaseUrl';

// ADR 0042 §2 — load resolution ladder for the Drive-file display route
// (`/display/drive/:driveFileId`):
//
//   1. Public read (anonymous): our own server proxy `/api/public/drive/:id`
//      reads "anyone with the link" files with a SERVER-side key — no sign-in,
//      no API key in the browser (ADR 0043 #3). Skipped when the backend has no
//      key (`drivePublicPreview` false) or after a Picker grant (that file is
//      private by definition).
//   2. Token read: the owner and recipients who already hold the per-file
//      Picker grant read with their drive.file token (ADR 0035 rule 2 —
//      the token comes ONLY from authStore.getValidToken()).
//   3+4. Everything else maps to a typed failure the gate screen renders.
//
// Provider-less by design (tactical note): the recipient may have no Drive
// root folder, no manifest, no place — this module must never route through
// GoogleDriveProvider or call listDiagrams.

export type DriveDisplayReadFailure =
  /** Signed out (or the token was rejected outright) and the file is not public. */
  | 'needs-signin'
  /**
   * 403/404 under a valid token: drive.file hides files until the Picker
   * grant registers, so both statuses read as "no per-file grant yet".
   */
  | 'needs-grant'
  /**
   * 403/404 on the post-grant retry (`afterGrant`): the pick "succeeded" yet
   * the file is still unreadable — deleted, access revoked, or a silently
   * failed grant. Terminal.
   */
  | 'not-found'
  /** Network failure / 5xx / rate limit — a reload may succeed. */
  | 'transient';

export type DriveDisplayReadResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: DriveDisplayReadFailure };

export interface DriveDisplayReadRequest {
  fileId: string;
  /**
   * The `?resourceKey=` search param carried on OUR preview URL (expected
   * absent on app-created files — ADR 0042 §1). The header is sent ONLY when
   * the link carried one.
   */
  resourceKey: string | null;
  /** false ⇒ the backend has no public-read key; the anonymous rung is skipped. */
  publicPreview: boolean;
  /** True on the gate's post-Picker retry — see 'not-found' above. */
  afterGrant?: boolean;
}

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

function mediaUrl(fileId: string): string {
  return `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`;
}

/**
 * Classify a 403 body. Google returns `error.errors[0].reason` (or
 * `error.status`); only `rateLimitExceeded`/`userRateLimitExceeded` is
 * transient — everything else is a permanent authorization failure that a
 * reload can't fix. Defensive against a non-JSON or string-shaped error body
 * (returns false ⇒ treat as permanent).
 */
async function is403RateLimited(res: Response): Promise<boolean> {
  try {
    const body = (await res.json()) as {
      error?: { status?: string; errors?: Array<{ reason?: string }> };
    };
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || '';
    return /rateLimitExceeded/i.test(reason);
  } catch {
    return false;
  }
}

function resourceKeyHeader(
  fileId: string,
  resourceKey: string | null
): Record<string, string> {
  return resourceKey
    ? { 'X-Goog-Drive-Resource-Keys': `${fileId}/${resourceKey}` }
    : {};
}

export async function readDriveDisplayFile(
  req: DriveDisplayReadRequest
): Promise<DriveDisplayReadResult> {
  // Rung 1 — anonymous public read via our server proxy (the key lives
  // server-side; ADR 0043 #3). Only "anyone with the link" files return 200;
  // any failure (non-public, network) falls through to the token rung, which
  // produces the user-visible discrimination. Skipped after a Picker grant —
  // that file is private, so the proxy would only 404.
  if (req.publicPreview && !req.afterGrant) {
    try {
      const qs = req.resourceKey
        ? `?resourceKey=${encodeURIComponent(req.resourceKey)}`
        : '';
      const res = await fetch(
        `${apiBaseUrl()}/api/public/drive/${encodeURIComponent(req.fileId)}${qs}`
      );
      if (res.ok) return { ok: true, data: await res.json() };
      // The proxy already gave the authoritative answer for a PUBLIC read, so
      // classify it here rather than falling through to the sign-in ladder
      // (sign-in can't help a public file):
      //   410 gone (trashed) / 413 too-large → terminal "could not open";
      //   429 / 5xx → transient → offer Retry.
      // Only a 404 (genuinely not public) falls through to the token rung, where
      // a signed-in recipient's per-file grant might read it.
      if (res.status === 410 || res.status === 413) {
        return { ok: false, reason: 'not-found' };
      }
      if (res.status === 429 || res.status >= 500) {
        return { ok: false, reason: 'transient' };
      }
    } catch {
      /* fall through to the token rung */
    }
  }

  // Rung 2 — token read.
  const token = await authStore.getValidToken();
  if (!token) return { ok: false, reason: 'needs-signin' };
  try {
    const res = await fetch(mediaUrl(req.fileId), {
      headers: {
        Authorization: `Bearer ${token}`,
        ...resourceKeyHeader(req.fileId, req.resourceKey)
      }
    });
    if (res.ok) return { ok: true, data: await res.json() };
    if (res.status === 401) {
      // Token rejected server-side despite passing the local expiry check —
      // arm the auth store so getValidToken() stops handing back the dead
      // token; otherwise the gate's post-sign-in auto-retry spins on it
      // (mirrors GoogleDriveProvider's 401 path).
      authStore.markExpired();
      return { ok: false, reason: 'needs-signin' };
    }
    if (res.status === 403) {
      // A 403 splits two ways: a rate limit is transient (a reload works);
      // everything else (missing per-file grant, insufficient scope) needs the
      // Picker grant — the recipient's only remedy on this route. Retrying a
      // permanent 403 as if transient would just spin.
      if (await is403RateLimited(res)) return { ok: false, reason: 'transient' };
      return { ok: false, reason: req.afterGrant ? 'not-found' : 'needs-grant' };
    }
    if (res.status === 404) {
      // drive.file hides ungranted files as 404 — pre-grant that means "grant
      // needed"; on the post-Picker retry it's terminal (deleted/revoked).
      return { ok: false, reason: req.afterGrant ? 'not-found' : 'needs-grant' };
    }
    // 429 + 5xx (and anything unexpected) — a reload may succeed.
    return { ok: false, reason: 'transient' };
  } catch {
    return { ok: false, reason: 'transient' };
  }
}
