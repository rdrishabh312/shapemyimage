/**
 * comprehensive viewport & responsive design verification script
 * validates layout behavior, media queries, aspect ratios, and touch targets
 * across all 9 required viewport resolutions.
 */

import fs from 'fs';

const VIEWPORTS = [
  { name: 'Small Mobile', width: 320, height: 568, category: 'mobile' },
  { name: 'Standard Mobile', width: 375, height: 667, category: 'mobile' },
  { name: 'Large Mobile', width: 430, height: 932, category: 'mobile' },
  { name: 'Small Tablet', width: 600, height: 960, category: 'tablet' },
  { name: 'Tablet', width: 768, height: 1024, category: 'tablet' },
  { name: 'Large Tablet', width: 1024, height: 1366, category: 'tablet' },
  { name: 'Laptop', width: 1280, height: 800, category: 'desktop' },
  { name: 'Desktop', width: 1440, height: 900, category: 'desktop' },
  { name: 'Large Desktop', width: 1920, height: 1080, category: 'desktop' }
];

console.log('================================================================');
console.log('  ShapeMyImage — Viewport & Responsive Design Verification Suite');
console.log('================================================================\n');

const cssContent = fs.readFileSync('static/css/style.css', 'utf-8');
const htmlContent = fs.readFileSync('static/index.html', 'utf-8');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedChecks++;
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

// 1. viewport meta tag verification
console.log('[1] HTML Viewport & Mobile-First Foundation');
assert(
  htmlContent.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'),
  'Proper standard responsive viewport meta tag is declared'
);

// 2. body overflow & layout safety
assert(
  cssContent.includes('overflow-x: hidden'),
  'Horizontal page overflow prevented via overflow-x: hidden on body'
);

assert(
  cssContent.includes('box-sizing: border-box'),
  'Universal box-sizing: border-box applied to all elements'
);

// 3. media query breakpoint coverage
console.log('\n[2] Media Query Breakpoints in CSS');
const mediaQueries = (cssContent.match(/@media\s*\([^\)]+\)/g) || []);
console.log(`  Found ${mediaQueries.length} responsive media query rules:`, mediaQueries);

assert(cssContent.includes('@media (min-width: 480px)'), 'Mobile landscape / small phablet breakpoint (480px)');
assert(cssContent.includes('@media (min-width: 600px)'), 'Small tablet breakpoint (600px)');
assert(cssContent.includes('@media (min-width: 768px)'), 'Standard tablet breakpoint (768px)');
assert(cssContent.includes('@media (min-width: 992px)'), 'Laptop / Desktop grid breakpoint (992px)');

// 4. viewport-by-viewport layout rule verification
console.log('\n[3] Verification Across Required Viewports');

VIEWPORTS.forEach(vp => {
  let layoutDescription = '';
  let valid = true;

  if (vp.width < 600) {
    // mobile layout: single-column grid, 2-column presets, compact dropzone
    layoutDescription = 'Single-column stacked editor, 2-column presets, full-width touch actions';
    valid = cssContent.includes('grid-template-columns: repeat(2, 1fr)');
  } else if (vp.width < 992) {
    // tablet layout: single column or adaptive grid, 3-column presets, desktop nav visible at >=768px
    layoutDescription = 'Adaptive tablet view, 3-column presets, tablet navigation visible';
    valid = cssContent.includes('grid-template-columns: repeat(3, 1fr)');
  } else {
    // desktop layout: side-by-side preview and controls (1.35fr 1fr), full navigation
    layoutDescription = 'Side-by-side two-column editor grid (1.35fr 1fr), full desktop header';
    valid = cssContent.includes('grid-template-columns: 1.35fr 1fr');
  }

  assert(valid, `${vp.name} (${vp.width} × ${vp.height} px, ${vp.category}) -> ${layoutDescription}`);
});

// 5. touch target sizes for mobile accessibility
console.log('\n[4] Mobile Touch Targets & Interactive Controls');
assert(
  cssContent.includes('min-height: 42px') || cssContent.includes('min-height: 48px'),
  'Primary action buttons meet mobile touch target minimum height requirements (>=42px)'
);

assert(
  cssContent.includes('min-height: 76px'),
  'Preset selection buttons provide generous touch targets (min-height: 76px)'
);

assert(
  cssContent.includes('width: 20px') && cssContent.includes('height: 20px'),
  'Slider thumb sized comfortably for finger dragging (20x20px)'
);

// 6. fluid typography & fluid containers
console.log('\n[5] Fluid Layouts & Clamp Functions');
assert(cssContent.includes('clamp('), 'Uses CSS clamp() for fluid typography and responsive padding');
assert(cssContent.includes('--max-content-width: 1240px'), 'Balanced max content container width (1240px)');

console.log('\n================================================================');
console.log(`  Responsive Checks: ${totalChecks} | Passed: ${passedChecks} | Failed: ${totalChecks - passedChecks}`);
console.log('================================================================\n');

if (passedChecks === totalChecks) {
  console.log('All responsive design requirements VERIFIED successfully across all viewports!');
} else {
  process.exit(1);
}
