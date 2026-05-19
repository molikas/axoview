import React from 'react';
import Axoview from 'src/Axoview';
import { initialData } from '../initialData';

export const BasicEditor = () => {
  return <Axoview initialData={{ ...initialData, fitToView: true }} />;
};
