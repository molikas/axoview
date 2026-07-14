import { authStore } from '../../stores/authStore';

// ADR 0042 §2 — load resolution ladder for the Drive-file display route
// (`/display/drive/:driveFileId`):
//
//   1. Key read (anonymous): succeeds for "anyone with the link" files with
//      just the public API key — no sign-in. Skipped when no key is configured
//      (graceful degradation, ADR 0042 §5).
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
  /** null ⇒ the anonymous key-read rung is unavailable and gets skipped. */
  googleApiKey: string | null;
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
  // Rung 1 — anonymous key read. Any failure (non-public file, restricted
  // key, network) falls through: the token rung produces the user-visible
  // discrimination, so the key rung never needs to.
  if (req.googleApiKey) {
    try {
      const res = await fetch(
        `${mediaUrl(req.fileId)}&key=${encodeURIComponent(req.googleApiKey)}`,
        { headers: resourceKeyHeader(req.fileId, req.resourceKey) }
      );
      if (res.ok) return { ok: true, data: await res.json() };
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
