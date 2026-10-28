# security policy

## supported versions

security updates and patches are actively maintained for the current release and main branch:

| version | supported          | status             |
| ------- | ------------------ | ------------------ |
| 1.0.x   | :white_check_mark: | current release    |
| main    | :white_check_mark: | active development |

---

## security model

ShapeMyImage is built on a defense-in-depth, zero-trust model:

1. **client-side isolation:** image manipulation occurs locally within client browser memory. user image payloads are not sent to or stored on remote servers.
2. **file signature validation:** binary headers are checked against genuine magic bytes before decoding.
3. **SVG sanitization:** all vector SVG files are parsed through strict sanitization filters to strip embedded `<script>` tags, inline event attributes (`onload`, `onerror`), and external XML entity references.
4. **memory exhaustion bounds:** decoded images are bounded to 12,000 × 12,000 pixels and 48 megapixels to prevent browser crash and decompression bomb attacks.
5. **hardened HTTP headers:** all HTTP responses include strict Content Security Policy (CSP), anti-clickjacking `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and restricted permissions policies.

---

## reporting a vulnerability

if you discover a security vulnerability within ShapeMyImage, please do not open a public issue. disclosing security exploits publicly puts users at risk before a fix is published.

instead, please report it privately:

- **private vulnerability reporting:** submit a confidential report via GitHub private vulnerability reporting under the repository security tab or contact the maintainer privately.

please include:
- a description of the vulnerability and its potential impact.
- step-by-step reproduction instructions or a minimal proof of concept (PoC).
- your proposed fix or remediation, if available.

i will review confirmed reports and work on fixes as soon as possible.
