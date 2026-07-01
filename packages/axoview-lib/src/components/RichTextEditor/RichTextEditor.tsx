import React, { useMemo, useRef, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import { Box } from '@mui/material';
import RichTextEditorErrorBoundary from './RichTextEditorErrorBoundary';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: number;
  styles?: React.CSSProperties;
  // Base typography for the editing surface — used to mirror an element-level
  // bold/italic/strikethrough so the editor reads the same as the canvas. Inline
  // (per-character) formatting in the content still layers on top.
  contentStyle?: React.CSSProperties;
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
  'blockquote',
  'code-block'
];

export const RichTextEditor = ({
  value,
  onChange,
  readOnly,
  height = 120,
  styles,
  contentStyle
}: Props) => {
  const isMountedRef = useRef(false);

  const modules = useMemo(() => {
    if (!readOnly)
      return {
        toolbar: tools,
        // MQA #12: Quill's default `list autofill` keyboard binding converted
        // `1. ` (or `* `, `- `) typed at the start of an empty line into an
        // empty list block. Because the line had no content yet, the user only
        // saw the typed `1. ` disappear with no list marker visible — perceived
        // as "input erased". Override the binding by name so the same key
        // triggers a no-op handler that returns true: the literal space is
        // inserted and the autofill never fires. Lists are still reachable via
        // the toolbar buttons. Bug only manifested on empty lines — typing the
        // marker mid-text was unaffected by the original code path either.
        keyboard: {
          bindings: {
            'list autofill': {
              key: ' ',
              shiftKey: null,
              collapsed: true,
              format: { list: false },
              prefix: /^\s*?(\d+\.|-|\*|\[ ?\]|\[x\])$/,
              handler() {
                return true;
              }
            }
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
            ...(readOnly ? { p: 0 } : {}),
            ...contentStyle
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
