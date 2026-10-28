# contributing to ShapeMyImage

thank you for your interest in contributing to **ShapeMyImage**! i welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## code of conduct

all contributors and participants are expected to adhere to the [code of conduct](CODE_OF_CONDUCT.md). please treat everyone with respect and kindness.

---

## development workflow

1. **fork the repository:** create a fork of the repository on github.
2. **clone your fork:**
   ```bash
   git clone https://github.com/rdrishabh312/shapemyimage.git
   cd shapemyimage
   ```
3. **create a feature branch:**
   ```bash
   git checkout -b feature/my-new-feature
   ```
4. **make your changes:**
   - keep code clean, idiomatic, and minimal.
   - maintain the privacy-first architecture: no remote server image processing.
   - ensure changes are responsive across mobile, tablet, and desktop screens.
5. **run the test suites:**
   ensure all automated verification suites pass without errors:
   ```bash
   cargo test
   node scripts/test_runner.js
   node scripts/test_viewports.js
   python3 scripts/test_png_export.py
   ```
6. **commit & push:**
   use clear, descriptive commit messages:
   ```bash
   git commit -m "feat: add hexagonal shape preset"
   git push origin feature/my-new-feature
   ```
7. **submit a pull request:** open a pull request on github against the `main` branch detailing what your changes accomplish.

---

## project structure guidelines

- **backend (`src/`):** lightweight rust axum service. keep dependencies minimal and security headers strict.
- **frontend (`static/`):** pure vanilla javascript (es modules) and css. avoid adding heavy frontend frameworks.
- **mathematical geometry (`static/js/geometry.js` & `src/geometry.rs`):** keep frontend and backend formulas 100% synchronized.

---

## reporting issues & feedback

if you find a bug or have a suggestion, feel free to open a pull request or contribute directly with fixes and improvements.
