import React from 'react';
import { Box, Typography } from '@mui/material';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { stripHtmlTags } from 'src/utils/stripHtml';

interface Props {
  /** Section title (already translated), e.g. "Notes". */
  title: string;
  value: string | undefined;
  onChange: (notes: string | undefined) => void;
  height?: number;
}

const hasContent = (v?: string) => !!v && stripHtmlTags(v).trim() !== '';

// Shared rich-text Notes editor (2026-07-02). Notes are available on every
// canvas element (node / connector / rectangle / text / label). Empty content is
// written as `undefined` so an untouched Notes never dirties the model.
export const NotesSection = ({ title, value, onChange, height = 200 }: Props) => (
  <Box sx={{ pt: 1.5, px: 2 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', mb: 0.75 }}
    >
      {title}
    </Typography>
    <RichTextEditor
      value={value}
      height={height}
      onChange={(text) => {
        const empty = !hasContent(text);
        if (empty && !hasContent(value)) return;
        if (value !== text) onChange(empty ? undefined : text);
      }}
    />
  </Box>
);
