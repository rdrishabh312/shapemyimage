/**
 * automated test suite for shapemyimage javascript geometry and sanitizer logic.
 */

import { analyzeDimensions, getSmartRadius, getExportGeometry, AspectCategory } from '../static/js/geometry.js';
import { validateMagicBytes, sanitizeSVG, validateImageDimensions } from '../static/js/sanitizer.js';
import fs from 'fs';

console.log('==================================================');
console.log('  Running ShapeMyImage Frontend Logic Test Suite  ');
console.log('==================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// ----------------------------------------------------
// 1. geometry & aspect ratio detection tests
// ----------------------------------------------------
console.log('[1] Geometry & Aspect Ratio Detection');

const square = analyzeDimensions(1000, 1000);
assert(square.category === AspectCategory.SQUARE, '1000x1000 classified as Square');
assert(square.ratioLabel === '1:1', '1000x1000 ratioLabel is 1:1');

const landscape = analyzeDimensions(1600, 900);
assert(landscape.category === AspectCategory.LANDSCAPE, '1600x900 classified as Landscape');
assert(landscape.ratioLabel === '16:9', '1600x900 ratioLabel is 16:9');

const portrait = analyzeDimensions(900, 1600);
assert(portrait.category === AspectCategory.PORTRAIT, '900x1600 classified as Portrait');
assert(portrait.ratioLabel === '9:16', '900x1600 ratioLabel is 9:16');

const extremeWide = analyzeDimensions(2400, 400);
assert(extremeWide.category === AspectCategory.EXTREME, '2400x400 classified as Extreme Aspect');

const extremeTall = analyzeDimensions(400, 2400);
assert(extremeTall.category === AspectCategory.EXTREME, '400x2400 classified as Extreme Aspect');

const small = analyzeDimensions(120, 120);
assert(small.category === AspectCategory.SQUARE, '120x120 classified as Square');

// ----------------------------------------------------
// 2. smart corner radius calculations
// ----------------------------------------------------
console.log('\n[2] Smart Corner Rounding Calculations');

// square: 0% = 0px, 100% = 500px (circle)
assert(getSmartRadius(1000, 1000, 0) === 0, 'Square 0% radius is 0px');
assert(getSmartRadius(1000, 1000, 50) === 250, 'Square 50% radius is 250px');
assert(getSmartRadius(1000, 1000, 100) === 500, 'Square 100% radius is 500px (circle)');

// landscape: 100% = 450px (capsule)
assert(getSmartRadius(1600, 900, 0) === 0, 'Landscape 0% radius is 0px');
assert(getSmartRadius(1600, 900, 100) === 450, 'Landscape 100% radius is 450px (H/2 capsule)');

// portrait: 100% = 450px (capsule)
assert(getSmartRadius(900, 1600, 100) === 450, 'Portrait 100% radius is 450px (W/2 capsule)');

// extreme aspect: min(w, h)/2 capped
assert(getSmartRadius(2400, 400, 100) === 200, 'Extreme wide 100% radius capped at 200px');

// ----------------------------------------------------
// 3. export geometry & preset crop policies
// ----------------------------------------------------
console.log('\n[3] Export Geometry & Preset Crop Policies');

const rectGeo = getExportGeometry(1600, 900, 'rounded-rect');
assert(rectGeo.outW === 1600 && rectGeo.outH === 900, 'Rounded rect preserves 1600x900 full dimensions');
assert(!rectGeo.isCropped, 'Rounded rect is not cropped');

const circleSquareGeo = getExportGeometry(1000, 1000, 'circle');
assert(circleSquareGeo.outW === 1000 && circleSquareGeo.outH === 1000, 'Circle on square keeps 1000x1000');
assert(!circleSquareGeo.isCropped, 'Circle on square does not crop');

const circleLandGeo = getExportGeometry(1600, 900, 'circle');
assert(circleLandGeo.outW === 900 && circleLandGeo.outH === 900, 'Circle on landscape center-crops to 900x900');
assert(circleLandGeo.cropX === 350, 'Circle cropX is centered (1600-900)/2 = 350');
assert(circleLandGeo.isCropped === true, 'Circle on landscape flags isCropped = true');

const passportSquareGeo = getExportGeometry(900, 900, 'passport');
assert(passportSquareGeo.outW === 700 && passportSquareGeo.outH === 900, 'Passport on 900x900 square crops to 700x900 (7:9)');
assert(passportSquareGeo.cropX === 100, 'Passport square cropX is centered (900-700)/2 = 100');
assert(passportSquareGeo.isCropped === true, 'Passport flags isCropped = true');

const passportLandGeo = getExportGeometry(1600, 900, 'passport');
assert(passportLandGeo.outW === 700 && passportLandGeo.outH === 900, 'Passport on 1600x900 landscape crops to 700x900 (7:9)');
assert(passportLandGeo.cropX === 450, 'Passport landscape cropX is centered (1600-700)/2 = 450');

// ----------------------------------------------------
// 4. file magic byte & format validation
// ----------------------------------------------------
console.log('\n[4] File Magic Byte & Format Validation');

const pngBuffer = fs.readFileSync('test_assets/square_1000x1000.png');
const pngVal = validateMagicBytes(pngBuffer);
assert(pngVal.valid && pngVal.format === 'PNG', 'Correctly identifies PNG magic bytes');

const jpgBuffer = fs.readFileSync('test_assets/landscape_1600x900.jpg');
const jpgVal = validateMagicBytes(jpgBuffer);
assert(jpgVal.valid && jpgVal.format === 'JPEG', 'Correctly identifies JPEG magic bytes');

const webpBuffer = fs.readFileSync('test_assets/extreme_wide_2400x400.webp');
const webpVal = validateMagicBytes(webpBuffer);
assert(webpVal.valid && webpVal.format === 'WebP', 'Correctly identifies WebP magic bytes');

const invalidBuffer = new Uint8Array([0x00, 0x11, 0x22, 0x33]).buffer;
const invalidVal = validateMagicBytes(invalidBuffer);
assert(!invalidVal.valid, 'Correctly rejects invalid binary header');

// ----------------------------------------------------
// 5. dimension limits & decompression bomb protection
// ----------------------------------------------------
console.log('\n[5] Dimension Limits & Decompression Bomb Protection');

assert(validateImageDimensions(1920, 1080).valid, 'Validates normal 1920x1080 dimensions');
assert(!validateImageDimensions(15000, 1000).valid, 'Rejects dimension exceeding 12,000px');
assert(!validateImageDimensions(9000, 9000).valid, 'Rejects 81MP image exceeding 48MP limit');
assert(!validateImageDimensions(0, 500).valid, 'Rejects zero dimension');

// ----------------------------------------------------
// summary
// ----------------------------------------------------
console.log('\n==================================================');
console.log(`  Tests Completed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All logic tests PASSED successfully!\n');
}
