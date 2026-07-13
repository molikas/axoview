import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ColorPickerBody } from '../ColorPickerBody';
import { STANDARD_COLOR_PALETTE } from 'src/config/colorPalette';

// Identity translator — a label renders as its key (ADR 0039 test; mirrors
// panelParity.test's approach so no LocaleProvider is needed).
jest.mock('src/stores/localeStore', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}));

// Stub the hue/sat + hex input — we only assert it appears when "Custom" is
// revealed, not the (already-tested) MuiColorInput internals.
jest.mock('../CustomColorInput', () => ({
  CustomColorInput: ({ value }: { value: string }) => (
    <div data-testid="custom-input">{value}</div>
  )
}));

const FLAT = STANDARD_COLOR_PALETTE.flat();

const renderBody = (props: Partial<React.ComponentProps<typeof ColorPickerBody>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <ColorPickerBody value={undefined} onChange={jest.fn()} {...props} />
    </ThemeProvider>
  );

const gridCells = () =>
  Array.from(document.querySelectorAll('[aria-label^="#"]'));

describe('ColorPickerBody', () => {
  it('renders every standard palette swatch', () => {
    renderBody();
    expect(gridCells()).toHaveLength(FLAT.length); // 80
    // spot-check a known base hue
    expect(screen.getByLabelText('#ff0000')).toBeInTheDocument();
  });

  it('fires onChange with the clicked swatch hex', () => {
    const onChange = jest.fn();
    renderBody({ onChange });
    fireEvent.click(screen.getByLabelText('#ff9900'));
    expect(onChange).toHaveBeenCalledWith('#ff9900');
  });

  it('marks the swatch matching the current value as active (aria-pressed)', () => {
    renderBody({ value: '#4a86e8' });
    expect(screen.getByLabelText('#4a86e8')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByLabelText('#ff0000')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('is case-insensitive when matching the active swatch', () => {
    renderBody({ value: '#FF0000' });
    expect(screen.getByLabelText('#ff0000')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('renders a checkmark inside the active swatch only (ADR 0039 Slides parity)', () => {
    renderBody({ value: '#4a86e8' });
    // The selected swatch carries the check icon; others do not.
    expect(screen.getByLabelText('#4a86e8').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByLabelText('#ff0000').querySelector('svg')).toBeNull();
  });

  it('is grid-first: the custom input is hidden until "Custom" is clicked', () => {
    // Even a bespoke (non-palette) value lands on the grid, not the custom input.
    renderBody({ value: '#123abc' });
    expect(screen.queryByTestId('custom-input')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /customColor/i }));
    expect(screen.getByTestId('custom-input')).toBeInTheDocument();
  });

  it('seeds the custom input with the current value when opened', () => {
    renderBody({ value: '#123abc' });
    fireEvent.click(screen.getByRole('button', { name: /customColor/i }));
    expect(screen.getByTestId('custom-input')).toHaveTextContent('#123abc');
  });

  describe('Transparent / no-color (contextual)', () => {
    it('shows the no-color swatch and clears via onNoColor when allowed', () => {
      const onNoColor = jest.fn();
      renderBody({ allowNoColor: true, onNoColor });
      const noColor = screen.getByRole('button', { name: 'noColor' });
      fireEvent.click(noColor);
      expect(onNoColor).toHaveBeenCalled();
    });

    it('marks no-color active when the value is transparent', () => {
      renderBody({ allowNoColor: true, onNoColor: jest.fn(), value: 'transparent' });
      // No grid cell should read as active in the transparent state.
      expect(gridCells().every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(
        true
      );
    });

    it('marks no-color active for an absent fill/background value (absentIsNoColor default)', () => {
      renderBody({ allowNoColor: true, onNoColor: jest.fn(), value: undefined });
      expect(screen.getByRole('button', { name: 'noColor' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('omits the no-color swatch for text color (no allowNoColor)', () => {
      renderBody({ value: '#000000' });
      expect(
        screen.queryByRole('button', { name: 'noColor' })
      ).not.toBeInTheDocument();
    });

    it('does NOT treat an absent rectangle-border value as no-color (absentIsNoColor=false)', () => {
      // The border derives a stroke when unset, so the no-color swatch must not
      // light up just because the colour is absent.
      renderBody({
        allowNoColor: true,
        onNoColor: jest.fn(),
        absentIsNoColor: false,
        value: undefined
      });
      expect(screen.getByRole('button', { name: 'noColor' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });
});
