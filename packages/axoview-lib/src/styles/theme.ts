import { createTheme, ThemeOptions } from '@mui/material';

interface CustomThemeVars {
  appPadding: {
    x: number;
    y: number;
  };
  toolMenu: {
    height: number;
  };
  customPalette: {
    [key in string]: string;
  };
}

declare module '@mui/material/styles' {
  interface Theme {
    customVars: CustomThemeVars;
  }

  interface ThemeOptions {
    customVars: CustomThemeVars;
  }

  // Custom typography variant for glanceable status badges (UX §1.5).
  interface TypographyVariants {
    micro: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    micro?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    micro: true;
  }
}

export const customVars: CustomThemeVars = {
  appPadding: {
    x: 40,
    y: 40
  },
  toolMenu: {
    height: 40
  },
  customPalette: {
    diagramBg: '#f6faff',
    defaultColor: '#a5b8f3'
  }
};

const createShadows = () => {
  const shadows = Array(25)
    .fill('none')
    .map((shadow, i) => {
      if (i === 0) return 'none';

      return `0px 10px 20px ${i - 10}px rgba(0,0,0,0.25)`;
    }) as Required<ThemeOptions>['shadows'];

  return shadows;
};

export const themeConfig: ThemeOptions = {
  customVars,
  shadows: createShadows(),
  spacing: 6,
  shape: {
    borderRadius: 6
  },
  transitions: {
    duration: {
      shortest: 50,
      shorter: 100,
      short: 150,
      standard: 200,
      complex: 250,
      enteringScreen: 150,
      leavingScreen: 100
    }
  },
  // Typography contract — see docs/ux-principles.md §1.5
  // Six tiers, picked by ROLE not visual size. Components use <Typography variant="…">;
  // never inline fontSize/fontWeight on Typography.
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      '"Fira Sans"',
      '"Droid Sans"',
      '"Helvetica Neue"',
      'sans-serif'
    ].join(','),
    fontSize: 14,
    h2: {
      fontSize: '2.5rem',
      fontStyle: 'bold',
      lineHeight: 1.2
    },
    h5: {
      fontSize: '1.15rem',
      lineHeight: 1.2
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.3
    },
    // Dialog/form body
    body1: {
      fontSize: '1rem',
      lineHeight: 1.4
    },
    // PRIMARY readable lists/forms — layer items, file tree, tab labels, side-panel fields
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.4
    },
    // Sub-labels — "Name", "Icon", helper text. Bumped from MUI default 0.75
    // to close the gap with body2 (was a jarring 14% step on dense panels).
    caption: {
      fontSize: '0.8125rem',
      lineHeight: 1.4
    },
    // Region wayfinding — sentence case per §1.2 / §7.2. Visual differentiation
    // comes from weight 600 + tracked-out spacing + smaller size. NO uppercase.
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'none',
      lineHeight: 1.5
    },
    // Glanceable status & badges, NOT prose — SESSION chip, storage gauge, item counts, hotkey hints
    micro: {
      fontSize: '0.6875rem',
      fontWeight: 500,
      lineHeight: 1.4
    }
  },
  palette: {
    secondary: {
      main: '#df004c'
    }
  },
  components: {
    MuiCard: {
      defaultProps: {
        elevation: 0,
        variant: 'outlined'
      }
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          backgroundColor: 'white'
        }
      }
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true
      },
      styleOverrides: {
        // C1 / Decision #6: a theme-wide keyboard focus ring on every button and
        // icon-button. MUI's ButtonBase draws no outline and disableRipple removes
        // the only other cue, so keyboard focus was invisible (P5-02). Scoped to
        // :focus-visible (Mui-focusVisible) so it stays keyboard-only and never
        // shows on mouse press; existing per-row rings are unaffected. Never add
        // outline:0 anywhere.
        root: ({ theme }) => ({
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
            borderRadius: 'inherit'
          }
        })
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        variant: 'contained',
        size: 'small',
        disableRipple: true,
        disableTouchRipple: true
      },
      styleOverrides: {
        root: {
          textTransform: 'none'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small'
      }
    },
    // All input surfaces (TextField, Select, Autocomplete) render text at body2
    // — matches "PRIMARY readable lists/forms" tier in §1.5. Without this MUI
    // defaults to body1 (1rem), which oversizes inputs against surrounding labels.
    MuiInputBase: {
      styleOverrides: {
        root: ({ theme }) => ({
          ...theme.typography.body2
        })
      }
    },
    // Form-control labels (Checkbox/Radio/Switch labels like "Custom color")
    // are body2 — same tier as input text. Without this MUI defaults to body1.
    MuiFormControlLabel: {
      styleOverrides: {
        label: ({ theme }) => ({
          ...theme.typography.body2
        })
      }
    },
    MuiSlider: {
      defaultProps: {
        size: 'small'
      }
    },
    MuiSvgIcon: {
      defaultProps: {
        color: 'action'
      },
      styleOverrides: {
        root: {
          width: 17,
          height: 17
        }
      }
    },
    // Tabs follow the body2 tier — readable label, not all-caps button.
    MuiTab: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          textTransform: 'none',
          minHeight: 36
        }
      }
    },
    // Chips default to caption tier; pass variant="micro" via the label slot
    // (or set `size="small"` Chips that house glanceable status indicators).
    MuiChip: {
      styleOverrides: {
        sizeSmall: {
          fontSize: '0.75rem',
          height: 20
        }
      }
    },
    // Map the custom "micro" variant to a paragraph element by default.
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          micro: 'span'
        }
      }
    }
  }
};

export const theme = createTheme(themeConfig);
