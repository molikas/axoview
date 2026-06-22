import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Icon } from '../Icon';
import { Icon as IconI } from 'src/types';

describe('Icon', () => {
  const flatIcon: IconI = {
    id: 'flaticon',
    name: 'flat icon',
    url: 'src/assets/grid-tile-bg.svg',
    isIsometric: false
  };

  const isometricIcon: IconI = {
    id: 'isoicon',
    name: 'isometric icon',
    url: 'src/assets/grid-tile-bg.svg',
    isIsometric: true
  };

  it('renders an img element for a flat icon', () => {
    render(<Icon icon={flatIcon} />);
    expect(screen.getByAltText('flat icon')).toBeInTheDocument();
  });

  it('renders an img element for an isometric icon', () => {
    render(<Icon icon={isometricIcon} />);
    expect(screen.getByAltText('isometric icon')).toBeInTheDocument();
  });

  // C2 / Decision #7 — the tile is keyboard-operable and AT-exposed.
  it('exposes the tile as a button labelled by the icon name', () => {
    render(<Icon icon={flatIcon} />);
    const tile = screen.getByRole('button', { name: 'flat icon' });
    expect(tile).toBeInTheDocument();
    // Defaults to non-tabbable (the grid promotes exactly one tile to 0).
    expect(tile).toHaveAttribute('tabindex', '-1');
  });

  it('honours the roving tabIndex passed by the grid', () => {
    render(<Icon icon={flatIcon} tabIndex={0} />);
    expect(screen.getByRole('button', { name: 'flat icon' })).toHaveAttribute(
      'tabindex',
      '0'
    );
  });

  it.each(['Enter', ' '])(
    'fires onActivate on %s (keyboard placement)',
    (key) => {
      const onActivate = jest.fn();
      render(<Icon icon={flatIcon} onActivate={onActivate} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'flat icon' }), {
        key
      });
      expect(onActivate).toHaveBeenCalledTimes(1);
    }
  );

  it('forwards non-activation keys to the grid onKeyDown (arrow nav)', () => {
    const onKeyDown = jest.fn();
    const onActivate = jest.fn();
    render(
      <Icon icon={flatIcon} onActivate={onActivate} onKeyDown={onKeyDown} />
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'flat icon' }), {
      key: 'ArrowRight'
    });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('forwards a ref to the focusable tile so the grid can move focus', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Icon icon={flatIcon} ref={ref} />);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'flat icon' }));
  });
});
