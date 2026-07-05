import React, { useMemo, useRef, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import { Box } from '@mui/material';
import { buildListAutofillBinding } from 'src/utils/quillListAutofill';
import RichTextEditorErrorBoundary from './RichTextEditorErrorBoundary';

// Paragraph alignment serializes as an inline `text-align` STYLE (not Quill's
// default ql-align-* class attributor): one representation flows through
// getSemanticHTML → sanitizeHtml → the resting canvas render with no
// ql-align CSS anywhere (ADR 0034 addendum 2026-07-03). Global registration,
// done once here — the module every Quill surface already imports for
// `formats`. No legacy class-based align exists (align was never authorable
// before this).
ReactQuill.Quill.register(
  'formats/align',
  ReactQuill.Quill.import('attributors/style/align'),
  true
);

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: number;
  styles?: React.CSSProperties;
}

// Rich text formatting tools
const tools = [
  'bold',
  'italic',
  'underline',
  'strike',
  'link',
  { header: [1, 2, 3, false] },
  { list: 'ordered' },
  { list: 'bullet' },
  'blockquote',
  'code-block'
];

// Formats that Quill should recognize
export const formats = [
  'bold',
  'italic',
  'underline',
  'strike',
  'link',
  'header',
  'list',
  // Paragraph alignment (ADR 0034 addendum 2026-07-03) — style attributor
  // registered above.
  'align',
  // Per-range text color (ADR 0034 addendum 2026-07-04): the strip's color
  // picker formats the live selection while editing; serialized as inline
  // color styles (Quill's built-in style attributor).
  'color',
  'blockquote',
  'code-block'
];

export const RichTextEditor = ({
  value,
  onChange,
  readOnly,
  height = 120,
  styles
}: Props) => {
  const isMountedRef = useRef(false);

  const modules = useMemo(() => {
    if (!readOnly)
      return {
        toolbar: tools,
        // Markdown list autofill ("- "/"* "/"1. " → list) — the shared binding
        // in quillListAutofill.ts, same behavior as the on-canvas text-box
        // editor. Retires the MQA #12 noop override; rationale + the
        // undo-restores-literal contract live in the util.
        keyboard: {
          bindings: {
            'list autofill': buildListAutofillBinding(ReactQuill.Quill)
          }
        }
      };

    return { toolbar: false };
  }, [readOnly]);

  // Quill fires onChange once on mount to normalize its internal state (e.g.
  // empty string → '<p><br></p>'). Skip that first synthetic call so it never
  // gets written back to the model.
  const handleChange = useCallback(
    (text: string) => {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      onChange?.(text);
    },
    [onChange]
  );

  return (
    <RichTextEditorErrorBoundary>
      <Box
        sx={{
          '.ql-toolbar.ql-snow': {
            border: 'none',
            pt: 0,
            px: 0,
            pb: 1
          },
          '.ql-toolbar.ql-snow + .ql-container.ql-snow': {
            border: '1px solid',
            borderColor: 'grey.300',
            borderTop: 'auto',
            borderRadius: 1.5,
            height,
            color: 'text.secondary'
          },
          '.ql-container.ql-snow': {
            ...(readOnly ? { border: 'none' } : {}),
            ...styles
          },
          '.ql-editor': {
            whiteSpace: 'pre-wrap',
            padding: '12px 15px',
            ...(readOnly ? { p: 0 } : {})
          },
          // Quill positions the link editor (.ql-tooltip) at the cursor; in the
          // narrow Notes panel that pushed it off the left edge, where the panel
          // clipped it so the "Enter link" input couldn't be seen in full. Pin
          // it to the editor's left and cap its width so it always fits, and let
          // a long URL wrap instead of overflowing.
          '.ql-tooltip': {
            zIndex: 1000,
            left: '4px !important',
            maxWidth: 'calc(100% - 8px)',
            boxSizing: 'border-box',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere'
          },
          '.ql-tooltip input[type=text]': {
            minWidth: 0
          }
        }}
      >
        <ReactQuill
          theme="snow"
          value={value ?? ''}
          readOnly={readOnly}
          onChange={handleChange}
          formats={formats}
          modules={modules}
        />
      </Box>
    </RichTextEditorErrorBoundary>
  );
};
