import React from 'react';
import Axoview from 'src/Axoview';
import { initialData } from '../initialData';

export const DebugTools = () => {
  return (
    <Axoview
      initialData={{ ...initialData, fitToView: true }}
      enableDebugTools
      height="100%"
    />
  );
};
