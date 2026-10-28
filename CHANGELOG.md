# changelog

all notable changes to ShapeMyImage will be documented in this file.

the format is based on [keep a changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [semantic versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-29

### added
- smart corner rounding adapting curvature across square, landscape, portrait, and extreme aspect ratios.
- multiple geometric image shapes: circles, ovals, rounded rectangles, squircles, and curved shapes.
- passport photo framing with portrait preset (35x45 ratio) and visual biometric face-alignment guides.
- transparent PNG export with genuine alpha transparency channel outside selected shapes.
- 100% client-side privacy architecture with in-browser image processing (no remote uploads).
- security hardening: binary magic bytes signature validation, strict svg sanitization against xss, and decompression bomb protection (bounded to 12,000x12,000px / 48 megapixels).
- lightweight rust axum backend service serving self-contained static assets with defense-in-depth security headers (csp, hsts, nosniff, frame-options deny).
- responsive multi-viewport design supporting mobile (320px+), tablet, and desktop screens with dark and light themes.
- automated verification test suites for backend api, frontend geometry calculations, responsive viewports, and png alpha export integrity.
