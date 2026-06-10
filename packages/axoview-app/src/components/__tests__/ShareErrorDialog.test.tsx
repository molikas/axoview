import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareErrorDialog } from '../ShareErrorDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key
  })
}));

function renderDialog(overrides: Partial<React.ComponentProps<typeof ShareErrorDialog>> = {}) {
  const onDismiss = jest.fn();
  const onRetry = jest.fn();
  render(
    <ShareErrorDialog open onDismiss={onDismiss} onRetry={onRetry} {...overrides} />
  );
  return { onDismiss, onRetry };
}

describe('ShareErrorDialog', () => {
  test('renders nothing when closed', () => {
    render(<ShareErrorDialog open={false} onDismiss={jest.fn()} onRetry={jest.fn()} />);
    expect(screen.queryByText("Couldn't create share link.")).not.toBeInTheDocument();
  });

  test('renders headline and body when open', () => {
    renderDialog();
    expect(screen.getByText("Couldn't create share link.")).toBeInTheDocument();
    expect(
      screen.getByText('Something went wrong. Try again in a moment.')
    ).toBeInTheDocument();
  });

  test('renders both a primary dismiss and a secondary retry action', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  test('clicking OK calls onDismiss and not onRetry', async () => {
    const user = userEvent.setup();
    const { onDismiss, onRetry } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  test('clicking Try again calls onRetry and not onDismiss', async () => {
    const user = userEvent.setup();
    const { onDismiss, onRetry } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('Escape dismissal routes through onDismiss', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderDialog();
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('carries the data-axoview-id contract hook on the paper surface', () => {
    renderDialog();
    expect(
      document.querySelector('[data-axoview-id="dialog-share-error"]')
    ).not.toBeNull();
  });
});
