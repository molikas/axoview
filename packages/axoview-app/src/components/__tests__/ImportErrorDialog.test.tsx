import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportErrorDialog } from '../ImportErrorDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key
  })
}));

describe('ImportErrorDialog', () => {
  test('renders nothing when closed', () => {
    render(<ImportErrorDialog open={false} onDismiss={jest.fn()} />);
    expect(screen.queryByText("Couldn't import.")).not.toBeInTheDocument();
  });

  test('renders headline and body when open', () => {
    render(<ImportErrorDialog open onDismiss={jest.fn()} />);
    expect(screen.getByText("Couldn't import.")).toBeInTheDocument();
    expect(
      screen.getByText(/This file isn't a valid Axoview diagram/)
    ).toBeInTheDocument();
  });

  test('has a single primary dismiss action and no secondary action', () => {
    render(<ImportErrorDialog open onDismiss={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  test('clicking OK calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    render(<ImportErrorDialog open onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('Escape dismissal routes through onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    render(<ImportErrorDialog open onDismiss={onDismiss} />);
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('carries the data-axoview-id contract hook on the paper surface', () => {
    render(<ImportErrorDialog open onDismiss={jest.fn()} />);
    expect(
      document.querySelector('[data-axoview-id="dialog-import-error"]')
    ).not.toBeNull();
  });
});
