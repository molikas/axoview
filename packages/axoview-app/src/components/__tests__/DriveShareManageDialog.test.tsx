import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriveShareManageDialog } from '../DriveShareManageDialog';
import {
  listPermissions,
  setAnyoneWithLink,
  addPersonPermission,
  removePermission
} from '../../services/drive/driveSharing';

// i18n isn't initialised in jsdom — resolve keys to their English fallback
// (string fallback, or the { defaultValue } form used for interpolated titles).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown) =>
      typeof fallback === 'string'
        ? fallback
        : (fallback as { defaultValue?: string })?.defaultValue ?? _k
  })
}));

jest.mock('../../services/drive/driveSharing', () => ({
  drivePreviewUrl: (id: string) => `http://localhost/app/display/drive/${id}`,
  listPermissions: jest.fn(),
  setAnyoneWithLink: jest.fn(),
  addPersonPermission: jest.fn(),
  removePermission: jest.fn()
}));

const listMock = listPermissions as jest.Mock;
const setAnyoneMock = setAnyoneWithLink as jest.Mock;
const addMock = addPersonPermission as jest.Mock;
const removeMock = removePermission as jest.Mock;

const OWNER = { id: 'owner', type: 'user', role: 'owner', emailAddress: 'me@x.com', displayName: 'Me' };
const JANE = { id: 'p-jane', type: 'user', role: 'reader', emailAddress: 'jane@x.com', displayName: 'Jane' };

beforeEach(() => {
  jest.clearAllMocks();
});

function renderOpen() {
  return render(
    <DriveShareManageDialog open fileId="f1" diagramName="My Diagram" onClose={() => {}} />
  );
}

test('shows the owner (you) as a non-removable row and grantees as removable rows', async () => {
  listMock.mockResolvedValueOnce([OWNER, JANE]);
  renderOpen();

  expect(await screen.findByText('Jane')).toBeInTheDocument();
  // The owner "you" row IS shown now (populated collaborative space), labelled
  // "Owner" and without a remove control.
  expect(screen.getByText('Me')).toBeInTheDocument();
  expect(screen.getByText('Owner')).toBeInTheDocument();
  // Only the non-owner grantee is removable.
  expect(screen.queryAllByLabelText('Remove access')).toHaveLength(1);
});

test('removing a person calls removePermission then re-reads the list', async () => {
  listMock.mockResolvedValueOnce([OWNER, JANE]).mockResolvedValueOnce([OWNER]);
  removeMock.mockResolvedValueOnce(undefined);
  renderOpen();
  const user = userEvent.setup();

  await screen.findByText('Jane');
  await user.click(screen.getByLabelText('Remove access'));

  await waitFor(() => expect(removeMock).toHaveBeenCalledWith('f1', 'p-jane'));
  expect(listMock).toHaveBeenCalledTimes(2); // initial load + post-mutation refresh
  await waitFor(() => expect(screen.queryByText('Jane')).toBeNull());
});

test('adding a person calls addPersonPermission with the email, viewer role, and a viewer-link invite', async () => {
  listMock.mockResolvedValueOnce([OWNER]).mockResolvedValueOnce([OWNER, JANE]);
  addMock.mockResolvedValueOnce(undefined);
  renderOpen();
  const user = userEvent.setup();

  await screen.findByText('Add people');
  // The role picker + Add button are hidden until an email is typed
  // (progressive disclosure).
  expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  await user.type(screen.getByPlaceholderText('name@example.com'), 'jane@x.com');
  await user.click(screen.getByRole('button', { name: 'Add' }));

  // Notifies, and the notification message points at OUR viewer (not the raw file).
  await waitFor(() =>
    expect(addMock).toHaveBeenCalledWith(
      'f1',
      'jane@x.com',
      'reader',
      true,
      expect.stringContaining('http://localhost/app/display/drive/f1')
    )
  );
});

test('Copy link writes the viewer preview URL to the clipboard', async () => {
  listMock.mockResolvedValueOnce([OWNER]);
  renderOpen();
  const user = userEvent.setup();

  await screen.findByText('Add people');
  await user.click(screen.getByRole('button', { name: /Copy link/ }));

  await waitFor(async () =>
    expect(await navigator.clipboard.readText()).toContain('display/drive/f1')
  );
});

test('surfaces a load error inline', async () => {
  listMock.mockRejectedValueOnce(new Error('boom'));
  renderOpen();
  // The inline error Alert renders (message = the thrown Error's text).
  expect(await screen.findByText(/boom/)).toBeInTheDocument();
});

test('reflecting an existing anyone-with-link grant does not trigger a write', async () => {
  listMock.mockResolvedValueOnce([OWNER, { id: 'a', type: 'anyone', role: 'reader' }]);
  renderOpen();

  // Loaded (the General-access control is present) and no spurious mutation fired.
  expect(await screen.findByText('General access')).toBeInTheDocument();
  expect(setAnyoneMock).not.toHaveBeenCalled();
});
