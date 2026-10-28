// shape geometry and clipping path calculation module
// provides exact, anti-aliased mathematical clipping paths for preview and export

export const AspectCategory = {
  SQUARE: 'Square',
  LANDSCAPE: 'Landscape',
  PORTRAIT: 'Portrait',
  EXTREME: 'Extreme Aspect Ratio'
};

// classifies image aspect ratio and calculates normalized proportions
export function analyzeDimensions(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    return {
      width: 0,
      height: 0,
      ratio: 1,
      category: AspectCategory.SQUARE,
      ratioLabel: '1:1',
      description: 'Invalid dimensions'
    };
  }

  const ratio = width / height;
  let category;

  if (ratio >= 3.0 || ratio <= 0.3333) {
    category = AspectCategory.EXTREME;
  } else if (ratio > 1.01) {
    category = AspectCategory.LANDSCAPE;
  } else if (ratio < 0.99) {
    category = AspectCategory.PORTRAIT;
  } else {
    category = AspectCategory.SQUARE;
  }

  // calculate clean aspect ratio label (16:9, 4:3, 1:1, or decimal)
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  const simW = Math.round(width / divisor);
  const simH = Math.round(height / divisor);
  
  let ratioLabel;
  if (simW <= 32 && simH <= 32) {
    ratioLabel = `${simW}:${simH}`;
  } else {
    ratioLabel = `${ratio.toFixed(2)}:1`;
  }

  return {
    width,
    height,
    ratio,
    category,
    ratioLabel,
    description: `${width} × ${height} px · ${category} (${ratioLabel})`
  };
}

// computes smart corner radius based on percentage (0-100) and dimensions
// square: 100% = circle (radius = w/2)
// landscape: 100% = horizontal pill (radius = h/2)
// portrait: 100% = vertical pill (radius = w/2)
// extreme: capped at min(w, h)/2
export function getSmartRadius(width, height, percent) {
  const clampedPercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const maxRadius = Math.min(width, height) / 2;
  return (clampedPercent / 100) * maxRadius;
}

// calculates export dimensions and source crop rect based on preset
export function getExportGeometry(srcW, srcH, preset) {
  if (preset === 'circle') {
    // circle preset uses a centered square crop of min(srcw, srch)
    const side = Math.min(srcW, srcH);
    const cropX = (srcW - side) / 2;
    const cropY = (srcH - side) / 2;
    const isCropped = srcW !== srcH;
    return {
      outW: side,
      outH: side,
      cropX,
      cropY,
      cropW: side,
      cropH: side,
      isCropped
    };
  }

  if (preset === 'passport') {
    // international standard 35mm x 45mm passport ratio (7:9)
    const targetAspect = 7 / 9;
    let cropW, cropH;
    if (srcW / srcH > targetAspect) {
      // source is wider than 7:9 -> crop width to match 7:9
      cropH = srcH;
      cropW = Math.round(srcH * targetAspect);
    } else {
      // source is taller than 7:9 -> crop height to match 7:9
      cropW = srcW;
      cropH = Math.round(srcW / targetAspect);
    }
    const cropX = Math.round((srcW - cropW) / 2);
    const cropY = Math.round((srcH - cropH) / 2);
    return {
      outW: cropW,
      outH: cropH,
      cropX,
      cropY,
      cropW,
      cropH,
      isCropped: true
    };
  }

  // all other presets preserve full source dimensions without cropping
  return {
    outW: srcW,
    outH: srcH,
    cropX: 0,
    cropY: 0,
    cropW: srcW,
    cropH: srcH,
    isCropped: false
  };
}

// builds clipping path on a 2d canvas context for preview and export
export function buildClipPath(ctx, x, y, w, h, preset, roundPercent = 0) {
  ctx.beginPath();

  switch (preset) {
    case 'circle': {
      // circle inside bounds
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    }

    case 'ellipse': {
      // oval clipped cleanly to w and h
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    }

    case 'curved-rect': {
      // squircle / superellipse: continuous g2 curvature
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const t = Math.max(0, Math.min(100, Number(roundPercent) || 0)) / 100;
      // map 0% -> n=16, 50% -> n=5.5 (classic squircle), 100% -> n=2.0 (full smooth curve)
      const n = 2.0 + Math.pow(1.0 - t, 2) * 14.0;
      const steps = 120; // polygon precision

      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const px = cx + Math.sign(cosT) * rx * Math.pow(Math.abs(cosT), 2 / n);
        const py = cy + Math.sign(sinT) * ry * Math.pow(Math.abs(sinT), 2 / n);
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      break;
    }

    case 'organic': {
      // organic curved pebble silhouette
      const cx = x + w / 2;
      const cy = y + h / 2;
      
      // control points for organic pebble shape
      const pts = [
        { x: 0.50, y: 0.04, cp1x: 0.76, cp1y: 0.04, cp2x: 0.96, cp2y: 0.22 },
        { x: 0.96, y: 0.50, cp1x: 0.96, cp1y: 0.72, cp2x: 0.82, cp2y: 0.94 },
        { x: 0.50, y: 0.96, cp1x: 0.25, cp1y: 0.96, cp2x: 0.04, cp2y: 0.78 },
        { x: 0.04, y: 0.50, cp1x: 0.04, cp1y: 0.26, cp2x: 0.26, cp2y: 0.04 }
      ];

      ctx.moveTo(x + pts[0].x * w, y + pts[0].y * h);
      ctx.bezierCurveTo(
        x + pts[0].cp1x * w, y + pts[0].cp1y * h,
        x + pts[0].cp2x * w, y + pts[0].cp2y * h,
        x + pts[1].x * w, y + pts[1].y * h
      );
      ctx.bezierCurveTo(
        x + pts[1].cp1x * w, y + pts[1].cp1y * h,
        x + pts[1].cp2x * w, y + pts[1].cp2y * h,
        x + pts[2].x * w, y + pts[2].y * h
      );
      ctx.bezierCurveTo(
        x + pts[2].cp1x * w, y + pts[2].cp1y * h,
        x + pts[2].cp2x * w, y + pts[2].cp2y * h,
        x + pts[3].x * w, y + pts[3].y * h
      );
      ctx.bezierCurveTo(
        x + pts[3].cp1x * w, y + pts[3].cp1y * h,
        x + pts[3].cp2x * w, y + pts[3].cp2y * h,
        x + pts[0].x * w, y + pts[0].y * h
      );
      break;
    }

    case 'rounded-rect': {
      // smart corner rounding with aspect-ratio-aware radius
      const r = getSmartRadius(w, h, roundPercent);
      if (r <= 0.5) {
        ctx.rect(x, y, w, h);
      } else if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        // fallback for environments without roundrect
        drawRoundedRectManual(ctx, x, y, w, h, r);
      }
      break;
    }

    case 'passport': {
      // passport standard rectangle with micro-corner rounding (0-25%)
      const r = getSmartRadius(w, h, roundPercent);
      if (r <= 0.5) {
        ctx.rect(x, y, w, h);
      } else if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        drawRoundedRectManual(ctx, x, y, w, h, r);
      }
      break;
    }

    case 'rectangle':
    default: {
      ctx.rect(x, y, w, h);
      break;
    }
  }

  ctx.closePath();
}

// manual fallback rounded rectangle using quadratic curves
function drawRoundedRectManual(ctx, x, y, w, h, r) {
  const rClamped = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rClamped, y);
  ctx.lineTo(x + w - rClamped, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rClamped);
  ctx.lineTo(x + w, y + h - rClamped);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rClamped, y + h);
  ctx.lineTo(x + rClamped, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rClamped);
  ctx.lineTo(x, y + rClamped);
  ctx.quadraticCurveTo(x, y, x + rClamped, y);
}
