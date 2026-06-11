import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyStateScreen } from '../EmptyStateScreen';

const getCreateHook = () =>
  document.querySelector('[data-axoview-id="screen-empty-create"]');
const getImportHook = () =>
  document.querySelector('[data-axoview-id="screen-empty-import"]');

describe('EmptyStateScreen', () => {
  test('preserves the data-axoview-id contract hooks the POM/smoke spec depend on', () => {
    render(<EmptyStateScreen onCreate={jest.fn()} onImport={jest.fn()} />);
    expect(getCreateHook()).not.toBeNull();
    expect(getImportHook()).not.toBeNull();
  });

  test('the whole card is the single interactive element — no button-inside-button', () => {
    render(<EmptyStateScreen onCreate={jest.fn()} onImport={jest.fn()} />);
    // Exactly two interactive elements: the two card action areas. The blue
    // "New diagram" / "Import" pills are demoted to non-interactive labels.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    // The hooks live on those interactive elements.
    expect(getCreateHook()?.tagName).toBe('BUTTON');
    expect(getImportHook()?.tagName).toBe('BUTTON');
    // The hook element must NOT contain a nested <button>.
    expect(getCreateHook()?.querySelector('button')).toBeNull();
    expect(getImportHook()?.querySelector('button')).toBeNull();
  });

  test('the card exposes an accessible name even though the visual pill is aria-hidden', () => {
    render(<EmptyStateScreen onCreate={jest.fn()} onImport={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'New diagram' })).toBe(
      getCreateHook()
    );
    expect(screen.getByRole('button', { name: 'Import' })).toBe(getImportHook());
  });

  test('clicking the create card fires onCreate', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    render(<EmptyStateScreen onCreate={onCreate} onImport={jest.fn()} />);
    await user.click(getCreateHook() as Element);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  test('clicking the import card fires onImport', async () => {
    const user = userEvent.setup();
    const onImport = jest.fn();
    render(<EmptyStateScreen onCreate={jest.fn()} onImport={onImport} />);
    await user.click(getImportHook() as Element);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  test('clicking the icon region (not the pill) still fires the card action', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    render(<EmptyStateScreen onCreate={onCreate} onImport={jest.fn()} />);
    // The icon sits inside the CardActionArea; a click on it bubbles to the
    // single card-level handler — proving the whole square is the target.
    const icon = getCreateHook()?.querySelector('svg');
    expect(icon).not.toBeNull();
    await user.click(icon as Element);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
