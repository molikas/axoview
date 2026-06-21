import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconGrid } from '../IconGrid';
import { Icon as IconI } from 'src/types';

// C2 / Decision #7 — roving tabindex + Enter/Space placement across the grid.
// The grid is 5 columns (GRID_COLUMNS); these tests assert focus movement and
// that activation reports the correct icon to the placement callback.

const makeIcons = (n: number): IconI[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `icon-${i}`,
    name: `icon ${i}`,
    url: 'x.svg',
    isIsometric: false
  }));

const tiles = () => screen.getAllByRole('button');

describe('IconGrid roving tabindex', () => {
  it('makes exactly one tile tabbable (the first by default)', () => {
    render(<IconGrid icons={makeIcons(7)} />);
    const all = tiles();
    expect(all[0]).toHaveAttribute('tabindex', '0');
    expect(all.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(
      1
    );
    all.slice(1).forEach((t) => expect(t).toHaveAttribute('tabindex', '-1'));
  });

  it('ArrowRight moves the tab stop and focus to the next tile', () => {
    render(<IconGrid icons={makeIcons(7)} />);
    fireEvent.keyDown(tiles()[0], { key: 'ArrowRight' });
    const all = tiles();
    expect(all[1]).toHaveAttribute('tabindex', '0');
    expect(all[0]).toHaveAttribute('tabindex', '-1');
    expect(all[1]).toHaveFocus();
  });

  it('ArrowDown moves focus down one row (±5 columns)', () => {
    render(<IconGrid icons={makeIcons(12)} />);
    fireEvent.keyDown(tiles()[0], { key: 'ArrowDown' });
    expect(tiles()[5]).toHaveFocus();
  });

  it('clamps at the grid edges instead of wrapping', () => {
    render(<IconGrid icons={makeIcons(3)} />);
    // ArrowLeft from the first tile stays put.
    fireEvent.keyDown(tiles()[0], { key: 'ArrowLeft' });
    expect(tiles()[0]).toHaveFocus();
    // ArrowRight past the last tile clamps to the last.
    fireEvent.keyDown(tiles()[0], { key: 'ArrowRight' });
    fireEvent.keyDown(tiles()[1], { key: 'ArrowRight' });
    fireEvent.keyDown(tiles()[2], { key: 'ArrowRight' });
    expect(tiles()[2]).toHaveFocus();
  });

  it('Enter on the focused tile activates THAT icon (viewport-centre placement)', () => {
    const onActivate = jest.fn();
    render(<IconGrid icons={makeIcons(7)} onActivate={onActivate} />);
    fireEvent.keyDown(tiles()[0], { key: 'ArrowRight' }); // focus icon-1
    fireEvent.keyDown(tiles()[1], { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'icon-1' })
    );
  });
});
