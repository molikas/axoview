// Lightweight stub of the fossflow lib for jest. The lib's bundled dist pulls
// in CSS, SVG, and react-quill-new — none of which the unit tests need. Only the
// pure functions we actually call from app code are reproduced here.

const stripDefaultIcons = (model) => model;
const mergeBundledFixtures = (model) => model;
const exportAsJSON = () => {};
const exportAsCompactJSON = () => {};
const transformFromCompactFormat = (m) => m;

module.exports = {
  stripDefaultIcons,
  mergeBundledFixtures,
  exportAsJSON,
  exportAsCompactJSON,
  transformFromCompactFormat
};
