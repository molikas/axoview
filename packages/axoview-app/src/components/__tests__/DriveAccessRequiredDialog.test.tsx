import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DriveAccessRequiredDialog } from '../DriveAccessRequiredDialog';
import { useAuthStore } from '../../stores/authStore';

// i18n isn't initialised in jsdom — resolve keys to their English fallback.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k })
}));
jest.mock('../../providers/AppStorageContext', () => ({
  useAppStorage: () => ({ googleDriveConfigured: true })
}));

const GRANT = 'Grant Drive access';
const CANCEL = 'Continue without Drive';

afterEach(() => {
  useAuthStore.setState({ status: 'UNAUTHENTICATED' });
});

describe('DriveAccessRequiredDialog', () => {
  test('stays hidden while the session is healthy', () => {
    useAuthStore.setState({ status: 'AUTHENTICATED' });
    render(<DriveAccessRequiredDialog />);
    expect(screen.queryByText(GRANT)).toBeNull();
  });

  test('blocks with grant/cancel actions when Drive access is required', async () => {
    const grantDriveAccess = jest.fn();
    const signOut = jest.fn();
    useAuthStore.setState({ status: 'DRIVE_ACCESS_REQUIRED', grantDriveAccess, signOut });
    render(<DriveAccessRequiredDialog />);
    const user = userEvent.setup();

    await user.click(screen.getByText(GRANT));
    expect(grantDriveAccess).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText(CANCEL));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
