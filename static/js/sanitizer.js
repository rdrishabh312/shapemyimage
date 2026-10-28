// security validation and sanitization helpers
// validates magic bytes, checks bounds, and sanitizes svg

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_DIMENSION = 12000; // 12,000 px
export const MAX_IMAGE_MEGAPIXELS = 48; // 48 MP

// validates file signature (magic bytes) from raw array buffer
export function validateMagicBytes(input) {
  if (!input || input.byteLength < 4) {
    return { valid: false, format: 'unknown', mime: '', error: 'File is empty or too small.' };
  }

  // handle both ArrayBuffer and TypedArray / Node.js Buffer cleanly
  const bytes = input instanceof Uint8Array
    ? input
    : (input instanceof ArrayBuffer 
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength));


  // png signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A &&
    bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    return { valid: true, format: 'PNG', mime: 'image/png' };
  }

  // jpeg signature: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valid: true, format: 'JPEG', mime: 'image/jpeg' };
  }

  // webp signature: RIFF .... WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { valid: true, format: 'WebP', mime: 'image/webp' };
  }

  // bmp signature: 'BM' (42 4D)
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return { valid: true, format: 'BMP', mime: 'image/bmp' };
  }

  // gif signature: 'GIF87a' or 'GIF89a' (47 49 46 38 37/39 61)
  if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return { 
      valid: true, 
      format: 'GIF', 
      mime: 'image/gif', 
      notice: 'Animated GIF detected: static PNG export will process the primary frame.' 
    };
  }

  // svg check: inspect text representation for <svg
  try {
    const textDecoder = new TextDecoder('utf-8');
    const headerSnippet = textDecoder.decode(buffer.slice(0, Math.min(buffer.byteLength, 1024))).trim();
    if (
      headerSnippet.includes('<svg') || 
      (headerSnippet.startsWith('<?xml') && headerSnippet.includes('<svg'))
    ) {
      return { valid: true, format: 'SVG', mime: 'image/svg+xml' };
    }
  } catch (e) {
    // decode failure fallback
  }

  return { 
    valid: false, 
    format: 'unknown', 
    mime: '', 
    error: 'Unsupported file format or invalid image header. Please upload PNG, JPG, WebP, BMP, GIF, or SVG.' 
  };
}

// sanitizes svg source string to neutralize any script execution
export function sanitizeSVG(svgContent) {
  if (typeof DOMParser === 'undefined') {
    return { sanitizedSvg: svgContent, sanitized: false };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return { sanitizedSvg: '', sanitized: false, error: 'Malformed or invalid SVG syntax.' };
    }

    const svgElement = doc.documentElement;
    if (svgElement.nodeName.toLowerCase() !== 'svg') {
      return { sanitizedSvg: '', sanitized: false, error: 'Root element is not an SVG.' };
    }

    let modified = false;

    // strip disallowed tags
    const dangerousTags = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video'];
    dangerousTags.forEach(tag => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach(el => {
        el.remove();
        modified = true;
      });
    });

    // remove all inline event handlers and suspicious protocol links
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        const attrVal = attr.value.trim().toLowerCase();

        // remove on* event handlers (onclick, onload, etc.)
        if (attrName.startsWith('on')) {
          el.removeAttribute(attr.name);
          modified = true;
        }

        // remove dangerous javascript/vbscript protocols
        if (attrName === 'href' || attrName === 'xlink:href' || attrName === 'src') {
          if (attrVal.startsWith('javascript:') || attrVal.startsWith('vbscript:')) {
            el.removeAttribute(attr.name);
            modified = true;
          }
        }
      });
    });

    const serializer = new XMLSerializer();
    const cleanSvg = serializer.serializeToString(svgElement);
    return { sanitizedSvg: cleanSvg, sanitized: modified };
  } catch (err) {
    return { sanitizedSvg: '', sanitized: false, error: 'SVG sanitization failed: ' + err.message };
  }
}

// validates loaded image dimensions against memory exhaustion bounds
export function validateImageDimensions(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    return { valid: false, error: 'Image has invalid or empty dimensions.' };
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${width} × ${height}) exceed maximum allowed limit of ${MAX_IMAGE_DIMENSION}px.`
    };
  }

  const megaPixels = (width * height) / 1000000;
  if (megaPixels > MAX_IMAGE_MEGAPIXELS) {
    return {
      valid: false,
      error: `Image size (${megaPixels.toFixed(1)} MP) exceeds memory limit of ${MAX_IMAGE_MEGAPIXELS} MP.`
    };
  }

  return { valid: true };
}
