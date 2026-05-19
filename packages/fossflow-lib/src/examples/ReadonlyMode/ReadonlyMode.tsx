import React from 'react';
import Axoview from 'src/Axoview';
import { initialData } from '../initialData';

export const ReadonlyMode = () => {
  return (
    <Axoview
      initialData={{ ...initialData, fitToView: true }}
      editorMode="EXPLORABLE_READONLY"
    />
  );
};
