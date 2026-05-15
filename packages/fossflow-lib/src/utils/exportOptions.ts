import domtoimage from 'dom-to-image-more';
import { optimizeSvgDataUrl } from './svgOptimizer';
import { stripDefaultIcons } from './leanSave';
import { Model, Size } from '../types';

export const generateGenericFilename = (extension: string) => {
  return `fossflow-export-${new Date().toISOString()}.${extension}`;
};

const slugifyTitle = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

export const generateTitleFilename = (
  title: string | undefined,
  extension: string
): string => {
  const slug = slugifyTitle(title || '');
  if (!slug) return generateGenericFilename(extension);
  // Short YYYYMMDD-HHmm suffix keeps the filename unique without dominating it.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${slug}-${stamp}.${extension}`;
};

export const base64ToBlob = (
  base64: string,
  contentType: string,
  sliceSize = 512
) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });

  return blob;
};

export const downloadFile = (data: Blob, filename: string) => {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportAsJSON = (model: Model) => {
  const lean = stripDefaultIcons(model);
  const data = new Blob([JSON.stringify(lean)], {
    type: 'application/json;charset=utf-8'
  });

  downloadFile(data, generateTitleFilename(model.title, 'json'));
};

export const exportAsImage = async (
  el: HTMLDivElement,
  size?: Size,
  scale: number = 1,
  bgcolor: string = '#ffffff'
) => {
  // Calculate scaled dimensions
  const width = size ? size.width * scale : el.clientWidth * scale;
  const height = size ? size.height * scale : el.clientHeight * scale;

  // dom-to-image-more is a better maintained fork
  const options = {
    width,
    height,
    cacheBust: true,
    bgcolor,
    quality: 1.0,
    // Apply CSS transform for high-quality scaling
    style:
      scale !== 1
        ? {
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }
        : undefined
  };

  try {
    const imageData = await domtoimage.toPng(el, options);
    return imageData;
  } catch (error) {
    console.error('Export failed, trying fallback method:', error);
    // Fallback: try with minimal options
    return await domtoimage.toPng(el, {
      width,
      height,
      cacheBust: true,
      bgcolor
    });
  }
};

export const exportAsSVG = async (
  el: HTMLDivElement,
  size?: Size,
  bgcolor: string = '#ffffff'
) => {
  const width = size ? size.width : el.clientWidth;
  const height = size ? size.height : el.clientHeight;

  const options = {
    width,
    height,
    cacheBust: true,
    bgcolor,
    quality: 1.0
  };

  try {
    const svgData = await domtoimage.toSvg(el, options);
    return optimizeSvgDataUrl(svgData);
  } catch (error) {
    console.error('SVG export failed, trying fallback method:', error);
    const fallback = await domtoimage.toSvg(el, {
      width,
      height,
      cacheBust: true,
      bgcolor
    });
    return optimizeSvgDataUrl(fallback);
  }
};
