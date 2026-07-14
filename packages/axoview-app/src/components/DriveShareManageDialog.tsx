import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  CloseOutlined as CloseIcon,
  DeleteOutlineOutlined as RemoveIcon
} from '@mui/icons-material';
import {
  DrivePermission,
  ShareRole,
  listPermissions,
  setAnyoneWithLink,
  addPersonPermission,
  removePermission
} from '../services/drive/driveSharing';

// ADR 0042 §1 (rev. 2026-07-14) — custom in-app "Manage access" over the Drive
// REST v3 permissions API (replaces the deprecated ShareClient widget). Grants
// apply immediately (Google-style), each with its own inline error; the whole
// list re-reads after every mutation so the UI never drifts from Drive's truth.

interface Props {
  open: boolean;
  fileId: string;
  diagramName?: string;
  onClose: () => void;
  /** Fired after any successful mutation so the caller can refresh its summary. */
  onAccessChanged?: () => void;
}

const roleLabelKey = (role: DrivePermission['role']): string => {
  switch (role) {
    case 'owner':
      return 'share.drive.manage.roleOwner';
    case 'writer':
    case 'fileOrganizer':
    case 'organizer':
      return 'share.drive.manage.roleEditor';
    default:
      return 'share.drive.manage.roleViewer';
  }
};

export function DriveShareManageDialog({
  open,
  fileId,
  diagramName,
  onClose,
  onAccessChanged
}: Props) {
  const { t } = useTranslation('app');
  // t is only used for FALLBACK error copy inside the async callbacks. Reading
  // it through a ref keeps `refresh`/`runAction` stable across locale changes,
  // so the open-effect below re-runs on open/fileId only (never on a new `t`).
  const tRef = useRef(t);
  tRef.current = t;
  const [permissions, setPermissions] = useState<DrivePermission[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<ShareRole>('reader');

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setPermissions(await listPermissions(fileId));
    } catch (err) {
      setPermissions([]);
      setLoadError(
        err instanceof Error
          ? err.message
          : tRef.current('share.drive.manage.loadError', "Couldn't load who has access.")
      );
    }
  }, [fileId]);

  useEffect(() => {
    if (!open) return;
    setPermissions(null);
    setActionError(null);
    setAddEmail('');
    setAddRole('reader');
    void refresh();
  }, [open, refresh]);

  // Run a mutation, then re-read the ACL from Drive (never trust local state) and
  // notify the caller. A single busy flag serialises the dialog's writes.
  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setActionError(null);
      try {
        await action();
        await refresh();
        onAccessChanged?.();
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : tRef.current('share.drive.manage.actionError', 'That change could not be saved.')
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh, onAccessChanged]
  );

  const anyoneOn = !!permissions?.some((p) => p.type === 'anyone');
  // People rows = OTHER named grantees. Exclude the link-anyone entry (the
  // General-access control owns it) and the owner (that's "you" — always
  // present, never removable), so an empty list truthfully means "only you".
  const people = (permissions ?? []).filter(
    (p) => (p.type === 'user' || p.type === 'group') && p.role !== 'owner'
  );

  const handleAdd = async () => {
    const email = addEmail.trim();
    if (!email) return;
    await runAction(() => addPersonPermission(fileId, email, addRole));
    setAddEmail('');
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          'data-axoview-id': 'drive-share-manage-dialog'
        } as ComponentProps<'div'>
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        {diagramName
          ? t('share.drive.manage.titleNamed', { name: diagramName, defaultValue: `Share "${diagramName}"` })
          : t('share.drive.manage.title', 'Manage access')}
        <IconButton
          onClick={onClose}
          disabled={busy}
          data-axoview-id="drive-share-manage-close"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {permissions === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : loadError ? (
          <Alert severity="error" data-axoview-id="drive-share-manage-load-error">
            {loadError}
          </Alert>
        ) : (
          <Stack spacing={2.5}>
            {actionError && (
              <Alert
                severity="error"
                onClose={() => setActionError(null)}
                data-axoview-id="drive-share-manage-action-error"
              >
                {actionError}
              </Alert>
            )}

            {/* General access — anyone-with-link toggle (the preview-link switch). */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('share.drive.manage.generalAccess', 'General access')}
              </Typography>
              <Select
                size="small"
                fullWidth
                value={anyoneOn ? 'anyone' : 'restricted'}
                disabled={busy}
                data-axoview-id="drive-share-manage-general-select"
                onChange={(e) =>
                  void runAction(() =>
                    setAnyoneWithLink(fileId, e.target.value === 'anyone')
                  )
                }
              >
                <MenuItem value="restricted">
                  {t('share.drive.manage.restricted', 'Restricted — only people with access')}
                </MenuItem>
                <MenuItem value="anyone">
                  {t('share.drive.manage.anyone', 'Anyone with the link can view')}
                </MenuItem>
              </Select>
            </Box>

            {/* People with access. */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('share.drive.manage.peopleWithAccess', 'People with access')}
              </Typography>
              {people.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('share.drive.manage.onlyYou', 'Only you have access so far.')}
                </Typography>
              ) : (
                <List dense disablePadding data-axoview-id="drive-share-manage-people">
                  {people.map((p) => (
                    <ListItem
                      key={p.id}
                      disableGutters
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          disabled={busy}
                          aria-label={t('share.drive.manage.remove', 'Remove access')}
                          data-axoview-id="drive-share-manage-remove"
                          onClick={() => void runAction(() => removePermission(fileId, p.id))}
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={p.displayName || p.emailAddress || p.id}
                        secondary={t(roleLabelKey(p.role), p.role)}
                        primaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            {/* Add a person by email. */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('share.drive.manage.addPeople', 'Add people')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  type="email"
                  placeholder={t('share.drive.manage.emailPlaceholder', 'name@example.com')}
                  value={addEmail}
                  disabled={busy}
                  data-axoview-id="drive-share-manage-add-email"
                  onChange={(e) => setAddEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAdd();
                    }
                  }}
                />
                <Select
                  size="small"
                  value={addRole}
                  disabled={busy}
                  data-axoview-id="drive-share-manage-add-role"
                  onChange={(e) => setAddRole(e.target.value as ShareRole)}
                  sx={{ minWidth: 104 }}
                >
                  <MenuItem value="reader">
                    {t('share.drive.manage.roleViewer', 'Viewer')}
                  </MenuItem>
                  <MenuItem value="writer">
                    {t('share.drive.manage.roleEditor', 'Editor')}
                  </MenuItem>
                </Select>
                <Button
                  variant="contained"
                  size="small"
                  disabled={busy || !addEmail.trim()}
                  onClick={() => void handleAdd()}
                  data-axoview-id="drive-share-manage-add-button"
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  {t('share.drive.manage.add', 'Add')}
                </Button>
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
