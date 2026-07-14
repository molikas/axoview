import { appDisplayBase } from '../../appBase';
import { authStore } from '../../stores/authStore';
import { loadGapiModule, Gapi } from './gapiLoader';

// ADR 0042 §1/§4 — Drive-place sharing surface. Deliberately OUTSIDE the
// StorageProvider interface: "sharing" a Drive diagram is a Drive ACL concern
// plus a deterministic preview URL, not a publish-a-snapshot contract.
// Permission CHANGES stay in Google's native dialog (v1 is native-dialog-only);
// this module only launches it, summarises the current ACL, and builds links.

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export interface FileShareMeta {
  /** Drive's own viewer URL — the mandated ShareClient fallback target. */
  webViewLink: string | null;
  /** Non-null only on link-shared legacy files; app-created files omit it. */
  resourceKey: string | null;
}

export type AccessSummary = 'anyone-with-link' | 'restricted';

// Minimal local ShareClient surface (no @types/gapi.* dependency — house rule).
interface ShareClient {
  setOAuthToken(token: string): void;
  setItemIds(ids: string[]): void;
  showSettingsDialog(): void;
}
type GapiWithShare = Gapi & {
  drive?: {
    share?: {
      ShareClient?: new (projectNumber?: string) => ShareClient;
    };
  };
};

/**
 * Preview URL for a Drive-place diagram — `/display/drive/<fileId>` under the
 * page origin + APP_BASENAME (same anchoring rationale as shareUrl.ts). The
 * link is LIVE (render-at-open, ADR 0042 §3), unlike `/display/p/<uuid>`
 * snapshots. `resourceKey` propagates as a query param iff present.
 */
export function drivePreviewUrl(fileId: string, resourceKey?: string | null): string {
  const base = `${appDisplayBase()}/drive/${encodeURIComponent(fileId)}`;
  return resourceKey
    ? `${base}?resourceKey=${encodeURIComponent(resourceKey)}`
    : base;
}

/** Token-authorized (ADR 0035 rule 2) fetch of the fields sharing needs. */
export async function getFileShareMeta(fileId: string): Promise<FileShareMeta> {
  const token = await authStore.getValidToken();
  if (!token) throw new Error('Not signed in to Google');
  const res = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=webViewLink,resourceKey`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive files.get failed (${res.status})`);
  const data = (await res.json()) as { webViewLink?: string; resourceKey?: string };
  return {
    webViewLink: data.webViewLink ?? null,
    resourceKey: data.resourceKey ?? null
  };
}

/**
 * One-line ACL state for the popover (ADR 0042 §1): does the copied preview
 * link work anonymously? `permissions.list` is authorized under `drive.file`
 * on app-created files; a `type:'anyone'` entry ⇒ link-readable.
 */
export async function getAccessSummary(fileId: string): Promise<AccessSummary> {
  const token = await authStore.getValidToken();
  if (!token) throw new Error('Not signed in to Google');
  // Drive PAGES permissions — a `type:'anyone'` grant can sit past page 1. The
  // token must be drained unconditionally: reading only the first page would
  // report a public file as 'restricted' and INVERT the owner-facing ACL
  // disclosure ("private" when the link is actually world-readable).
  let pageToken: string | undefined;
  do {
    const url =
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions` +
      `?fields=${encodeURIComponent('nextPageToken,permissions(type,role)')}&pageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Drive permissions.list failed (${res.status})`);
    const data = (await res.json()) as {
      permissions?: Array<{ type?: string }>;
      nextPageToken?: string;
    };
    if ((data.permissions ?? []).some((p) => p.type === 'anyone')) {
      return 'anyone-with-link';
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return 'restricted';
}

/**
 * Google's native sharing dialog (`drive-share` ShareClient). The dialog needs
 * third-party cookies + a signed-in Google browser session, so the
 * drive.google.com fallback is mandatory, not polish (ADR 0042 §1): on ANY
 * failure, open the file's API-returned `webViewLink` in a new tab (never a
 * hand-built `file/d/{id}/view`); `open?id=` is the last resort when even
 * that fetch fails. `projectNumber` is the Cloud project NUMBER from
 * runtime config (ADR 0042 §5) — null lets gapi use its default.
 */
export async function openNativeShareDialog(
  fileId: string,
  projectNumber: string | null
): Promise<void> {
  try {
    const token = await authStore.getValidToken();
    if (!token) throw new Error('Not signed in to Google');
    const gapi = (await loadGapiModule('drive-share')) as GapiWithShare;
    const ShareClientCtor = gapi.drive?.share?.ShareClient;
    if (!ShareClientCtor) throw new Error('ShareClient unavailable after module load');
    const client = new ShareClientCtor(projectNumber ?? undefined);
    client.setOAuthToken(token);
    client.setItemIds([fileId]);
    client.showSettingsDialog();
  } catch {
    let url: string | null = null;
    try {
      url = (await getFileShareMeta(fileId)).webViewLink;
    } catch {
      /* fall through to the constructed last resort */
    }
    window.open(
      url ?? `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`,
      '_blank',
      'noopener'
    );
  }
}
