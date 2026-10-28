// main application logic
// coordinates ui state, file upload, geometry preview, and high-res png export

import { analyzeDimensions, getSmartRadius, getExportGeometry, buildClipPath } from './geometry.js';
import { validateMagicBytes, sanitizeSVG, validateImageDimensions, MAX_FILE_SIZE_BYTES } from './sanitizer.js';

// haptic feedback helper using web vibration api
function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(22);
          break;
        case 'heavy':
          navigator.vibrate([30, 40, 30]);
          break;
        case 'selection':
          navigator.vibrate(8);
          break;
        default:
          navigator.vibrate(12);
      }
    } catch (_) {
      // safe no-op on platforms without vibration
    }
  }
}

let lastSliderHaptic = 0;
function triggerSliderHaptic() {
  const now = performance.now();
  if (now - lastSliderHaptic > 45) {
    lastSliderHaptic = now;
    triggerHaptic('selection');
  }
}

class ShapeMyImageApp {
  constructor() {
    this.state = {
      image: null,
      naturalWidth: 0,
      naturalHeight: 0,
      fileName: 'image',
      activePreset: 'rounded-rect',
      roundPercent: 25,
      currentBlobUrl: null,
      isExporting: false,
      isUserUploaded: false,
      exportFormat: 'webp',
      // framing and zoom state
      zoom: 1.0,
      panOffsetX: 0,
      panOffsetY: 0,
      showFaceGuide: true,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      startPanOffsetX: 0,
      startPanOffsetY: 0,
    };
    this.dom = {};
    this.initElements();
    this.bindEvents();
    this.initTheme();
    this.initDefaultState();
  }

  initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem('theme');
    } catch (e) {
      savedTheme = null;
    }

    let activeTheme = 'dark';
    if (savedTheme === 'light' || savedTheme === 'dark') {
      activeTheme = savedTheme;
    } else {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      activeTheme = prefersLight ? 'light' : 'dark';
    }

    document.documentElement.setAttribute('data-theme', activeTheme);
    this.updateThemeColor(activeTheme);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        let hasCustomTheme = false;
        try {
          hasCustomTheme = !!localStorage.getItem('theme');
        } catch (err) {
          hasCustomTheme = false;
        }
        if (!hasCustomTheme) {
          const next = e.matches ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          this.updateThemeColor(next);
          this.scheduleRender();
        }
      });
    }
  }

  toggleTheme() {
    triggerHaptic('light');
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch (e) {
      // ignore
    }
    this.updateThemeColor(nextTheme);
    this.scheduleRender();
    this.showToast(`Switched to ${nextTheme} theme`, 'info');
  }

  updateThemeColor(theme) {
    const isLight = theme === 'light';
    const color = isLight ? '#f5f5f7' : '#09090b';

    // sync theme-color meta tags for mobile status bar
    const themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
    if (themeColorMetas.length > 0) {
      themeColorMetas.forEach((meta) => {
        meta.removeAttribute('media');
        meta.setAttribute('content', color);
      });
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }

    // sync apple status bar style
    const appleMeta = document.getElementById('meta-apple-status-bar') || document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      appleMeta.setAttribute('content', isLight ? 'default' : 'black-translucent');
    }
  }

  initElements() {
    this.dom = {
      themeToggleBtn: document.getElementById('theme-toggle'),
      mobileUploadBtn: document.getElementById('mobile-upload-btn') || document.getElementById('header-upload-btn'),
      headerUploadBtn: document.getElementById('header-upload-btn'),
      dropZone: document.getElementById('drop-zone'),
      fileInput: document.getElementById('file-input'),
      browseBtn: document.getElementById('browse-btn'),
      editorSection: document.getElementById('editor-section'),
      previewCanvas: document.getElementById('preview-canvas'),
      previewWrapper: document.getElementById('preview-wrapper'),
      infoBadge: document.getElementById('image-info-badge'),
      cropNotice: document.getElementById('crop-notice'),
      roundSlider: document.getElementById('round-slider'),
      roundPercentDisplay: document.getElementById('round-percent-display'),
      roundRadiusDisplay: document.getElementById('round-radius-display'),
      sliderGroup: document.getElementById('slider-group'),
      framingGroup: document.getElementById('framing-group'),
      zoomSlider: document.getElementById('zoom-slider'),
      zoomPercentDisplay: document.getElementById('zoom-percent-display'),
      zoomInBtn: document.getElementById('zoom-in-btn'),
      zoomOutBtn: document.getElementById('zoom-out-btn'),
      resetFramingBtn: document.getElementById('reset-framing-btn'),
      toggleFaceGuideBtn: document.getElementById('toggle-face-guide-btn'),
      presetButtons: document.querySelectorAll('.preset-btn'),
      downloadBtn: document.getElementById('download-btn'),
      downloadBtnText: document.getElementById('download-btn-text'),
      formatBtns: document.querySelectorAll('.btn-format'),
      downloadHint: document.getElementById('download-hint'),
      resetBtn: document.getElementById('reset-btn'),
      replaceBtn: document.getElementById('replace-btn'),
      toastContainer: document.getElementById('toast-container'),
      showcaseItems: document.querySelectorAll('.showcase-card')
    };
  }

  bindEvents() {
    // theme toggle
    if (this.dom.themeToggleBtn) {
      this.dom.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // direct upload buttons
    const triggerUpload = (e) => {
      e?.preventDefault();
      this.dom.fileInput?.click();
    };
    if (this.dom.mobileUploadBtn) {
      this.dom.mobileUploadBtn.addEventListener('click', triggerUpload);
    }
    if (this.dom.headerUploadBtn && this.dom.headerUploadBtn !== this.dom.mobileUploadBtn) {
      this.dom.headerUploadBtn.addEventListener('click', triggerUpload);
    }

    // dropzone and file input
    if (this.dom.dropZone) {
      this.dom.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
      this.dom.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      this.dom.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
      this.dom.dropZone.addEventListener('click', (e) => {
        if (e.target !== this.dom.browseBtn) {
          this.dom.fileInput.click();
        }
      });
      // keyboard support on dropzone
      this.dom.dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.dom.fileInput.click();
        }
      });
    }

    if (this.dom.browseBtn) {
      this.dom.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.fileInput.click();
      });
    }

    if (this.dom.fileInput) {
      this.dom.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // replace and reset buttons
    if (this.dom.replaceBtn) {
      this.dom.replaceBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        this.dom.fileInput.click();
      });
    }

    if (this.dom.resetBtn) {
      this.dom.resetBtn.addEventListener('click', () => {
        triggerHaptic('medium');
        this.resetSettings();
      });
    }

    // corner radius slider
    if (this.dom.roundSlider) {
      this.tuneSliderTouchScrolling(this.dom.roundSlider, (val) => {
        triggerSliderHaptic();
        this.state.roundPercent = Number(val);
        this.updateSliderDisplay();
        this.scheduleRender();
      });
    }

    // zoom slider and buttons
    if (this.dom.zoomSlider) {
      this.tuneSliderTouchScrolling(this.dom.zoomSlider, (val) => {
        triggerSliderHaptic();
        this.setZoom(Number(val) / 100);
      });
    }

    if (this.dom.zoomInBtn) {
      this.dom.zoomInBtn.addEventListener('click', () => {
        triggerHaptic('light');
        this.setZoom(this.state.zoom + 0.1);
      });
    }

    if (this.dom.zoomOutBtn) {
      this.dom.zoomOutBtn.addEventListener('click', () => {
        triggerHaptic('light');
        this.setZoom(this.state.zoom - 0.1);
      });
    }

    if (this.dom.resetFramingBtn) {
      this.dom.resetFramingBtn.addEventListener('click', () => {
        triggerHaptic('light');
        this.resetFraming();
      });
    }

    if (this.dom.toggleFaceGuideBtn) {
      this.dom.toggleFaceGuideBtn.addEventListener('click', () => {
        this.toggleFaceGuide();
      });
    }

    // canvas drag to pan photo
    this.bindCanvasPanEvents();

    // preset buttons
    this.dom.presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.selectPreset(preset);
      });
    });

    // download button
    if (this.dom.downloadBtn) {
      this.dom.downloadBtn.addEventListener('click', () => this.exportPNG());
    }

    // export format selector buttons
    if (this.dom.formatBtns) {
      this.dom.formatBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.setExportFormat(btn.dataset.format);
        });
      });
    }

    // download hint shortcut to trigger upload
    if (this.dom.downloadHint) {
      this.dom.downloadHint.addEventListener('click', () => {
        this.dom.fileInput?.click();
      });
    }

    // window resize handling
    window.addEventListener('resize', () => {
      if (this.state.image) {
        this.scheduleRender();
      }
    });

    // clipboard paste support
    document.addEventListener('paste', (e) => this.handlePaste(e));

    // showcase interactive cards
    this.dom.showcaseItems.forEach((card) => {
      card.addEventListener('click', () => {
        triggerHaptic('light');
        const preset = card.dataset.preset;
        if (preset) {
          this.selectPreset(preset);
          if (this.dom.editorSection) {
            this.dom.editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          const presetName = this.getPresetDisplayName(preset);
          this.showToast(`Applied ${presetName} shape`, 'info');
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  bindCanvasPanEvents() {
    const canvas = this.dom.previewCanvas;
    if (!canvas) return;

    const onPointerDown = (clientX, clientY) => {
      if (!this.state.image || !this.state.isUserUploaded) return;
      this.state.isDragging = true;
      this.state.dragStartX = clientX;
      this.state.dragStartY = clientY;
      this.state.startPanOffsetX = this.state.panOffsetX;
      this.state.startPanOffsetY = this.state.panOffsetY;
      if (this.dom.previewWrapper) {
        this.dom.previewWrapper.classList.add('is-dragging');
      }
    };

    const onPointerMove = (clientX, clientY) => {
      if (!this.state.isDragging || !this.state.image || !this.state.isUserUploaded) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const effCrop = this.calculateEffectiveCrop();
      const scale = effCrop.cropW / rect.width;
      const dx = clientX - this.state.dragStartX;
      const dy = clientY - this.state.dragStartY;
      this.state.panOffsetX = this.state.startPanOffsetX - dx * scale;
      this.state.panOffsetY = this.state.startPanOffsetY - dy * scale;
      this.clampPan();
      this.scheduleRender();
    };

    const onPointerUp = () => {
      if (this.state.isDragging) {
        this.state.isDragging = false;
        if (this.dom.previewWrapper) {
          this.dom.previewWrapper.classList.remove('is-dragging');
        }
      }
    };

    canvas.addEventListener('mousedown', (e) => {
      if (!this.state.image || !this.state.isUserUploaded) return;
      if (e.button === 0) {
        onPointerDown(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.state.isDragging) {
        onPointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', onPointerUp);

    // multi-touch drag and pinch gestures
    let touchMode = 'none'; // 'drag' or 'pinch'
    let initialPinchDistance = 0;
    let initialPinchZoom = 1.0;

    const getTouchDistance = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    };

    const targetEl = this.dom.previewWrapper || canvas;

    targetEl.addEventListener('touchstart', (e) => {
      // allow touch scroll when no image is loaded
      if (!this.state.image || !this.state.isUserUploaded) return;

      if (e.touches.length === 1) {
        touchMode = 'drag';
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        touchMode = 'pinch';
        this.state.isDragging = false;
        if (this.dom.previewWrapper) {
          this.dom.previewWrapper.classList.remove('is-dragging');
        }
        initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialPinchZoom = this.state.zoom;
        e.preventDefault();
      }
    }, { passive: false });

    targetEl.addEventListener('touchmove', (e) => {
      // allow touch scroll when no image is loaded
      if (!this.state.image || !this.state.isUserUploaded) return;

      if (e.touches.length === 1 && touchMode === 'drag' && this.state.isDragging) {
        e.preventDefault();
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && touchMode === 'pinch' && initialPinchDistance > 0) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        if (currentDistance > 10) {
          const factor = currentDistance / initialPinchDistance;
          this.setZoom(initialPinchZoom * factor);
        }
      }
    }, { passive: false });

    const onTouchEnd = (e) => {
      if (!this.state.isUserUploaded) return;
      if (e.touches.length === 0) {
        touchMode = 'none';
        initialPinchDistance = 0;
        onPointerUp();
      } else if (e.touches.length === 1 && touchMode === 'pinch') {
        touchMode = 'drag';
        initialPinchDistance = 0;
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    targetEl.addEventListener('touchend', onTouchEnd, { passive: false });
    targetEl.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // ios safari gesture handling
    targetEl.addEventListener('gesturestart', (e) => {
      if (!this.state.image || !this.state.isUserUploaded) return;
      e.preventDefault();
      initialPinchZoom = this.state.zoom;
    }, { passive: false });

    targetEl.addEventListener('gesturechange', (e) => {
      if (!this.state.image || !this.state.isUserUploaded) return;
      e.preventDefault();
      this.setZoom(initialPinchZoom * e.scale);
    }, { passive: false });

    targetEl.addEventListener('gestureend', (e) => {
      if (!this.state.isUserUploaded) return;
      e.preventDefault();
    }, { passive: false });

    // mouse wheel zoom over canvas
    targetEl.addEventListener('wheel', (e) => {
      if (!this.state.image || !this.state.isUserUploaded) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      this.setZoom(this.state.zoom + delta);
    }, { passive: false });
  }

  // touch-aware mobile slider controller to prevent accidental swipe jumps
  tuneSliderTouchScrolling(slider, onUpdate) {
    if (!slider) return;

    let startX = 0;
    let startY = 0;
    let initialValue = Number(slider.value);
    let gestureIntent = 'undecided'; // 'undecided' | 'scrolling' | 'sliding'
    let isTouchActive = false;

    slider.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      isTouchActive = true;
      gestureIntent = 'undecided';
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      initialValue = Number(slider.value);
    }, { passive: true });

    slider.addEventListener('touchmove', (e) => {
      if (!isTouchActive || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (gestureIntent === 'undecided') {
        // vertical swipe means user is scrolling
        if (absDy >= absDx && absDy >= 6) {
          gestureIntent = 'scrolling';
          return;
        }
        // horizontal swipe means user is sliding
        if (absDx > absDy && absDx >= 8) {
          gestureIntent = 'sliding';
        }
      }

      if (gestureIntent === 'sliding') {
        if (e.cancelable) {
          e.preventDefault();
        }
        const rect = slider.getBoundingClientRect();
        if (rect.width > 0) {
          const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
          const min = Number(slider.min) || 0;
          const max = Number(slider.max) || 100;
          const step = Number(slider.step) || 1;
          const raw = min + ratio * (max - min);
          const stepped = Math.round((raw - min) / step) * step + min;
          const finalVal = Math.max(min, Math.min(max, stepped));

          slider.value = finalVal;
          onUpdate(finalVal);
        }
      }
    }, { passive: false });

    const finishTouch = () => {
      gestureIntent = 'undecided';
      setTimeout(() => {
        isTouchActive = false;
      }, 50);
    };

    slider.addEventListener('touchend', finishTouch, { passive: true });
    slider.addEventListener('touchcancel', finishTouch, { passive: true });

    // handle mouse drag and keys
    slider.addEventListener('input', (e) => {
      // suppress accidental jumps while scrolling
      if (isTouchActive && gestureIntent !== 'sliding') {
        slider.value = initialValue;
        return;
      }
      onUpdate(Number(e.target.value));
    });
  }

  setZoom(zoomVal) {
    const clamped = Math.max(1.0, Math.min(3.0, Math.round(zoomVal * 20) / 20));
    this.state.zoom = clamped;
    if (this.dom.zoomSlider) {
      this.dom.zoomSlider.value = Math.round(clamped * 100);
    }
    if (this.dom.zoomPercentDisplay) {
      this.dom.zoomPercentDisplay.textContent = `${Math.round(clamped * 100)}%`;
    }
    this.clampPan();
    this.scheduleRender();
  }

  resetFraming() {
    triggerHaptic('light');
    this.state.zoom = 1.0;
    this.state.panOffsetX = 0;
    this.state.panOffsetY = 0;
    if (this.dom.zoomSlider) {
      this.dom.zoomSlider.value = 100;
    }
    if (this.dom.zoomPercentDisplay) {
      this.dom.zoomPercentDisplay.textContent = '100%';
    }
    this.scheduleRender();
    this.showToast('Photo position centered', 'info');
  }

  toggleFaceGuide() {
    triggerHaptic('light');
    this.state.showFaceGuide = !this.state.showFaceGuide;
    if (this.dom.toggleFaceGuideBtn) {
      this.dom.toggleFaceGuideBtn.textContent = this.state.showFaceGuide ? 'Face Guide: ON' : 'Face Guide: OFF';
      this.dom.toggleFaceGuideBtn.classList.toggle('active', this.state.showFaceGuide);
    }
    this.scheduleRender();
  }

  clampPan() {
    const { naturalWidth, naturalHeight, activePreset, zoom } = this.state;
    if (!naturalWidth || !naturalHeight) return;
    const baseGeo = getExportGeometry(naturalWidth, naturalHeight, activePreset);
    const effW = Math.max(1, Math.min(naturalWidth, baseGeo.cropW / zoom));
    const effH = Math.max(1, Math.min(naturalHeight, baseGeo.cropH / zoom));
    const maxShiftX = Math.max(0, (naturalWidth - effW) / 2);
    const maxShiftY = Math.max(0, (naturalHeight - effH) / 2);
    this.state.panOffsetX = Math.max(-maxShiftX, Math.min(maxShiftX, this.state.panOffsetX));
    this.state.panOffsetY = Math.max(-maxShiftY, Math.min(maxShiftY, this.state.panOffsetY));
  }

  calculateEffectiveCrop() {
    const { naturalWidth, naturalHeight, activePreset, zoom, panOffsetX, panOffsetY } = this.state;
    const baseGeo = getExportGeometry(naturalWidth || 800, naturalHeight || 600, activePreset);

    const effW = Math.max(1, Math.min(naturalWidth || 800, baseGeo.cropW / zoom));
    const effH = Math.max(1, Math.min(naturalHeight || 600, baseGeo.cropH / zoom));

    const defaultCropX = ((naturalWidth || 800) - effW) / 2;
    const defaultCropY = ((naturalHeight || 600) - effH) / 2;

    const maxCropX = Math.max(0, (naturalWidth || 800) - effW);
    const maxCropY = Math.max(0, (naturalHeight || 600) - effH);

    const cropX = Math.max(0, Math.min(maxCropX, defaultCropX + panOffsetX));
    const cropY = Math.max(0, Math.min(maxCropY, defaultCropY + panOffsetY));

    const isCropped = baseGeo.isCropped || zoom > 1.0;

    return {
      outW: baseGeo.outW,
      outH: baseGeo.outH,
      cropX,
      cropY,
      cropW: effW,
      cropH: effH,
      isCropped
    };
  }

  drawThickStudioGuide(ctx, drawPathFn) {
    ctx.save();
    ctx.setLineDash([6, 5]);

    // dark halo line for light photos
    ctx.lineWidth = 3.0;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    drawPathFn(ctx);
    ctx.stroke();

    // white core line for dark photos
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffffff';
    drawPathFn(ctx);
    ctx.stroke();

    ctx.restore();
  }

  drawPassportFaceGuide(ctx, w, h) {
    ctx.save();

    // passport biometric standards (icao doc 9303 / 35x45mm)
    // scale factor: 1mm in canvas units for 35x45mm
    const mm = h / 45;
    const cx = w / 2;

    // biometric proportions
    // head height: 34mm
    // crown margin: 4mm from top
    // chin baseline: 38mm from top
    // head center and eye level: 21mm
    // head width: 25mm
    const crownY = 4.0 * mm;
    const eyeY = 21.0 * mm;
    const chinY = 38.0 * mm;

    const headCy = 21.0 * mm;      // vertical center of head
    const headRy = 17.0 * mm;      // 34mm total head height
    const headRx = 12.5 * mm;      // 25mm total head width

    // vertical facial symmetry axis
    this.drawThickStudioGuide(ctx, (c) => {
      c.beginPath();
      c.moveTo(cx, 0);
      c.lineTo(cx, h);
    });

    // head silhouette oval
    this.drawThickStudioGuide(ctx, (c) => {
      c.beginPath();
      c.ellipse(cx, headCy, headRx, headRy, 0, 0, Math.PI * 2);
    });

    // eye level guideline
    this.drawThickStudioGuide(ctx, (c) => {
      c.beginPath();
      c.moveTo(w * 0.08, eyeY);
      c.lineTo(w * 0.92, eyeY);
    });

    // chin guideline
    this.drawThickStudioGuide(ctx, (c) => {
      c.beginPath();
      c.moveTo(w * 0.18, chinY);
      c.lineTo(w * 0.82, chinY);
    });

    // guide labels
    ctx.save();
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // eye level label
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('EYE LEVEL', w * 0.94, eyeY - 4);

    // chin label
    ctx.textBaseline = 'top';
    ctx.fillText('CHIN', w * 0.82, chinY + 4);

    ctx.restore();

    ctx.restore();
  }

  updateDownloadBtnState() {
    if (!this.dom.downloadBtn) return;
    const isUserUploaded = Boolean(this.state.isUserUploaded);
    if (isUserUploaded) {
      this.dom.downloadBtn.disabled = false;
      this.dom.downloadBtn.removeAttribute('title');
      if (this.dom.downloadHint) {
        this.dom.downloadHint.style.display = 'none';
      }
    } else {
      this.dom.downloadBtn.disabled = true;
      this.dom.downloadBtn.setAttribute('title', 'Please upload your image to download');
      if (this.dom.downloadHint) {
        this.dom.downloadHint.style.display = 'flex';
      }
    }
  }

  setExportFormat(format) {
    if (!['webp', 'png', 'jpeg'].includes(format)) return;
    triggerHaptic('light');
    this.state.exportFormat = format;
    if (this.dom.formatBtns) {
      this.dom.formatBtns.forEach((btn) => {
        const isActive = btn.dataset.format === format;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }
    this.updateDownloadBtnLabel();
  }

  updateDownloadBtnLabel() {
    if (!this.dom.downloadBtnText) {
      this.dom.downloadBtnText = document.getElementById('download-btn-text');
    }
    if (!this.dom.downloadBtnText) return;

    if (this.state.exportFormat === 'webp') {
      this.dom.downloadBtnText.textContent = 'Download Transparent WebP';
    } else if (this.state.exportFormat === 'jpeg') {
      this.dom.downloadBtnText.textContent = 'Download JPG Photo';
    } else {
      this.dom.downloadBtnText.textContent = 'Download Transparent PNG';
    }
  }

  updateInteractiveState() {
    const isUserUploaded = Boolean(this.state.isUserUploaded);
    if (this.dom.previewWrapper) {
      this.dom.previewWrapper.classList.toggle('interactive-drag', isUserUploaded);
      this.dom.previewWrapper.style.touchAction = isUserUploaded ? 'none' : 'pan-y';
    }
    if (this.dom.previewCanvas) {
      this.dom.previewCanvas.style.touchAction = isUserUploaded ? 'none' : 'pan-y';
    }
  }

  initDefaultState() {
    this.state.isUserUploaded = false;
    if (this.dom.infoBadge) {
      this.dom.infoBadge.style.display = 'none';
      this.dom.infoBadge.innerHTML = '';
    }
    this.updateDownloadBtnState();
    this.updateDownloadBtnLabel();
    this.updateInteractiveState();
    this.updateSliderDisplay();
    // preload initial demonstration image
    this.loadSampleImage('/samples/showcase-square.webp?v=2', 'rounded-rect', false, false);
  }

  showToast(message, type = 'info') {
    if (!this.dom.toastContainer) return;

    // single active toast at a time
    while (this.dom.toastContainer.firstChild) {
      this.dom.toastContainer.removeChild(this.dom.toastContainer.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    let iconMarkup = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'error') {
      iconMarkup = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (type === 'success') {
      iconMarkup = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
    }

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${iconMarkup}</span>
        <span class="toast-message">${this.escapeHtml(message)}</span>
      </div>
      <button type="button" class="toast-close" aria-label="Close message">×</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('toast-fade');
      setTimeout(() => toast.remove(), 200);
    });
    this.dom.toastContainer.appendChild(toast);

    // auto-dismiss toast
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('toast-fade');
        setTimeout(() => toast.remove(), 200);
      }
    }, 1000);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dom.dropZone.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dom.dropZone.classList.remove('drag-over');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dom.dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      this.processFile(files[0], { shouldToast: true, shouldScroll: true, isUserUpload: true });
    }
  }

  handleFileSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      this.processFile(files[0], { shouldToast: true, shouldScroll: true, isUserUpload: true });
    }
  }

  handlePaste(e) {
    if (!e.clipboardData || !e.clipboardData.items) return;
    for (const item of e.clipboardData.items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          this.processFile(file, { shouldToast: true, shouldScroll: true, isUserUpload: true });
          this.showToast('Pasted image from clipboard', 'info');
          break;
        }
      }
    }
  }

  async processFile(file, options = { shouldToast: true, shouldScroll: true, isUserUpload: true }) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.showToast(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 50MB limit.`, 'error');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const validation = validateMagicBytes(buffer);

      if (!validation.valid) {
        this.showToast(validation.error || 'Invalid file format.', 'error');
        return;
      }

      if (validation.notice) {
        this.showToast(validation.notice, 'info');
      }

      let imageSrc;
      let cleanUpNeeded = true;

      if (validation.format === 'SVG') {
        const textDecoder = new TextDecoder('utf-8');
        const rawSvg = textDecoder.decode(buffer);
        const { sanitizedSvg, error } = sanitizeSVG(rawSvg);
        if (error) {
          this.showToast(error, 'error');
          return;
        }
        const svgBlob = new Blob([sanitizedSvg], { type: 'image/svg+xml' });
        imageSrc = URL.createObjectURL(svgBlob);
      } else {
        const blob = new Blob([buffer], { type: validation.mime });
        imageSrc = URL.createObjectURL(blob);
      }

      const img = new Image();
      img.onload = () => {
        const dimValidation = validateImageDimensions(img.naturalWidth, img.naturalHeight);
        if (!dimValidation.valid) {
          URL.revokeObjectURL(imageSrc);
          this.showToast(dimValidation.error, 'error');
          return;
        }

        // cleanup previous object url
        if (this.state.currentBlobUrl) {
          URL.revokeObjectURL(this.state.currentBlobUrl);
        }
        this.state.currentBlobUrl = imageSrc;

        // base filename without extension
        const rawName = file.name || 'image';
        this.state.fileName = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;
        this.state.image = img;
        this.state.naturalWidth = img.naturalWidth;
        this.state.naturalHeight = img.naturalHeight;
        this.state.zoom = 1.0;
        this.state.panOffsetX = 0;
        this.state.panOffsetY = 0;
        this.state.isUserUploaded = (options && options.isUserUpload !== undefined) ? Boolean(options.isUserUpload) : true;
        this.updateDownloadBtnState();
        this.updateInteractiveState();
        if (this.dom.zoomSlider) this.dom.zoomSlider.value = 100;
        if (this.dom.zoomPercentDisplay) this.dom.zoomPercentDisplay.textContent = '100%';

        this.updateDimensionsUI();
        this.scheduleRender();
        if (options && options.shouldToast) {
          triggerHaptic('medium');
          this.showToast(`Loaded ${this.state.fileName} (${img.naturalWidth} × ${img.naturalHeight} px)`, 'success');
        }

        // scroll smoothly to editor
        if (options && options.shouldScroll && this.dom.editorSection) {
          this.dom.editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      img.onerror = () => {
        if (cleanUpNeeded) URL.revokeObjectURL(imageSrc);
        this.showToast('Failed to decode image data.', 'error');
      };

      img.src = imageSrc;
    } catch (err) {
      console.error(err);
      this.showToast('Error reading file: ' + err.message, 'error');
    }
  }

  async loadSampleImage(url, preset = 'rounded-rect', shouldToast = true, shouldScroll = false) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Sample not found');
      const blob = await response.blob();
      const file = new File([blob], url.split('/').pop(), { type: blob.type || 'image/webp' });
      await this.processFile(file, { shouldToast: false, shouldScroll, isUserUpload: false });
      if (preset) {
        this.selectPreset(preset);
      }
      if (shouldToast) {
        this.showToast(`Loaded demonstration for ${preset} shape`, 'info');
      }
    } catch (err) {
      console.warn('Could not load sample image:', err);
      this.createFallbackSquareImage(preset);
    }
  }

  createFallbackSquareImage(preset = 'rounded-rect') {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    
    // placeholder dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, '#28324b');
    grad.addColorStop(1, '#141928');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 800);
    
    // ambient portrait lighting
    const radial = ctx.createRadialGradient(400, 360, 40, 400, 400, 420);
    radial.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
    radial.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, 800, 800);
    
    const img = new Image();
    img.onload = () => {
      this.state.image = img;
      this.state.naturalWidth = 800;
      this.state.naturalHeight = 800;
      this.state.fileName = 'square-demo';
      this.state.isUserUploaded = false;
      this.updateDownloadBtnState();
      this.updateDimensionsUI();
      if (preset) this.selectPreset(preset);
      this.scheduleRender();
    };
    img.src = canvas.toDataURL('image/png');
  }

  selectPreset(preset) {
    triggerHaptic('light');
    this.state.activePreset = preset;

    this.dom.presetButtons.forEach((b) => {
      const isSelected = b.dataset.preset === preset;
      b.classList.toggle('active', isSelected);
      b.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    this.updateDownloadBtnState();

    // zoom and pan controls
    if (this.dom.framingGroup) {
      this.dom.framingGroup.style.display = 'flex';
    }
    this.updateInteractiveState();

    // face guide toggle only for passport
    if (this.dom.toggleFaceGuideBtn) {
      this.dom.toggleFaceGuideBtn.style.display = (preset === 'passport') ? 'inline-flex' : 'none';
      this.dom.toggleFaceGuideBtn.classList.toggle('active', Boolean(this.state.showFaceGuide));
      this.dom.toggleFaceGuideBtn.textContent = this.state.showFaceGuide ? 'Face Guide: ON' : 'Face Guide: OFF';
    }

    // constrain pan within bounds
    this.clampPan();

    const sliderTitle = document.getElementById('slider-title-label');
    const sliderDesc = document.getElementById('slider-explanation-text');

    if (preset === 'passport') {
      this.dom.sliderGroup.style.display = 'flex';
      if (sliderTitle) sliderTitle.textContent = 'Corner Rounding';
      if (sliderDesc) {
        sliderDesc.textContent = 'Passport photo standard: 0% sharp studio corners (official specification).';
      }
      // passport defaults to sharp corners
      this.state.roundPercent = 0;
      if (this.dom.roundSlider) this.dom.roundSlider.value = 0;
    } else if (preset === 'rounded-rect') {
      this.dom.sliderGroup.style.display = 'flex';
      if (sliderTitle) sliderTitle.textContent = 'Corner Rounding';
      if (sliderDesc) {
        sliderDesc.textContent = 'Aspect-ratio aware: At 100%, square images become a circle; landscape/portrait images become a capsule pill.';
      }
      if (this.state.roundPercent === 0) {
        this.state.roundPercent = 25;
        if (this.dom.roundSlider) this.dom.roundSlider.value = 25;
      }
    } else if (preset === 'curved-rect') {
      this.dom.sliderGroup.style.display = 'flex';
      if (sliderTitle) sliderTitle.textContent = 'Curvature Intensity';
      if (sliderDesc) {
        sliderDesc.textContent = 'Continuous squircle curvature: smooth continuous G2 aesthetic blending from subtle to deep.';
      }
      if (this.state.roundPercent === 0) {
        this.state.roundPercent = 40;
        if (this.dom.roundSlider) this.dom.roundSlider.value = 40;
      }
    } else {
      // fixed geometry presets
      this.dom.sliderGroup.style.display = 'none';
    }

    this.updateCropNotice();
    this.updateSliderDisplay();
    this.scheduleRender();
  }

  getPresetDisplayName(preset) {
    const names = {
      'rounded-rect': 'Rounded Rectangle',
      'circle': 'Circle',
      'passport': 'Passport Photo',
      'ellipse': 'Oval / Ellipse',
      'curved-rect': 'Squircle',
      'organic': 'Organic Curve',
      'rectangle': 'Original Rectangle'
    };
    return names[preset] || preset;
  }

  resetSettings() {
    // preserve currently selected shape
    const currentPreset = this.state.activePreset || 'rounded-rect';

    // reset zoom and pan framing
    this.state.zoom = 1.0;
    this.state.panOffsetX = 0;
    this.state.panOffsetY = 0;
    this.state.showFaceGuide = true;

    // reset preset defaults
    if (currentPreset === 'passport') {
      this.state.roundPercent = 0; // standard sharp corners
    } else if (currentPreset === 'rounded-rect') {
      this.state.roundPercent = 25;
    } else if (currentPreset === 'curved-rect') {
      this.state.roundPercent = 40;
    } else {
      this.state.roundPercent = 0;
    }

    if (this.dom.roundSlider) {
      this.dom.roundSlider.value = this.state.roundPercent;
    }
    if (this.dom.zoomSlider) {
      this.dom.zoomSlider.value = 100;
    }
    if (this.dom.zoomPercentDisplay) {
      this.dom.zoomPercentDisplay.textContent = '100%';
    }
    if (this.dom.toggleFaceGuideBtn) {
      this.dom.toggleFaceGuideBtn.textContent = 'Face Guide: ON';
      this.dom.toggleFaceGuideBtn.classList.add('active');
    }

    // keep chosen shape
    this.selectPreset(currentPreset);
    this.updateDimensionsUI();
    this.updateInteractiveState();
    this.showToast('Reset framing & zoom to default', 'info');
  }

  updateDimensionsUI() {
    const { naturalWidth, naturalHeight, activePreset, isUserUploaded } = this.state;
    const analysis = analyzeDimensions(naturalWidth, naturalHeight);

    let category = analysis.category;
    let ratioLabel = analysis.ratioLabel;

    if (activePreset === 'passport') {
      category = 'Passport';
      ratioLabel = '7:9';
    }

    if (this.dom.infoBadge) {
      // hide badge when no user image
      if (!isUserUploaded) {
        this.dom.infoBadge.style.display = 'none';
        this.dom.infoBadge.innerHTML = '';
      } else {
        this.dom.infoBadge.style.display = 'inline-flex';
        this.dom.infoBadge.innerHTML = `
          <span class="info-tag-dims">${analysis.width} × ${analysis.height} px</span>
          <span class="info-tag-sep">·</span>
          <span class="info-tag-category">${category}</span>
          <span class="info-tag-ratio">(${ratioLabel})</span>
        `;
      }
    }

    this.updateCropNotice();
    this.updateSliderDisplay();
  }

  updateCropNotice() {
    if (!this.dom.cropNotice) return;
    const { naturalWidth, naturalHeight, activePreset } = this.state;
    const geo = getExportGeometry(naturalWidth, naturalHeight, activePreset);

    if (activePreset === 'passport') {
      this.dom.cropNotice.textContent = `Passport Photo: Official 35 × 45 mm (7:9) biometric ratio. Drag preview to position face; use zoom for framing.`;
      this.dom.cropNotice.style.display = 'block';
    } else if (geo.isCropped && activePreset === 'circle') {
      this.dom.cropNotice.textContent = `Circle preset uses center crop (${geo.outW} × ${geo.outH} px) to create a perfect circle without stretching.`;
      this.dom.cropNotice.style.display = 'block';
    } else {
      this.dom.cropNotice.style.display = 'none';
    }
  }

  updateSliderDisplay() {
    const { roundPercent, naturalWidth, naturalHeight, activePreset } = this.state;

    if (this.dom.roundPercentDisplay) {
      this.dom.roundPercentDisplay.textContent = `${roundPercent}%`;
    }

    if (this.dom.roundRadiusDisplay) {
      if (activePreset === 'curved-rect') {
        const t = roundPercent / 100;
        const n = 2.0 + Math.pow(1.0 - t, 2) * 14.0;
        this.dom.roundRadiusDisplay.textContent = `Curve: n = ${n.toFixed(1)}`;
      } else {
        const radiusPx = getSmartRadius(naturalWidth || 800, naturalHeight || 600, roundPercent);
        this.dom.roundRadiusDisplay.textContent = `Radius: ${Math.round(radiusPx)} px`;
      }
    }
  }

  scheduleRender() {
    if (!this.state.renderScheduled) {
      this.state.renderScheduled = true;
      requestAnimationFrame(() => {
        this.renderPreview();
        this.state.renderScheduled = false;
      });
    }
  }

  renderPreview() {
    const canvas = this.dom.previewCanvas;
    if (!canvas || !this.state.image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { activePreset, roundPercent, showFaceGuide } = this.state;
    const effCrop = this.calculateEffectiveCrop();

    // compute preview display dimensions
    const container = this.dom.previewWrapper;
    const maxDisplayWidth = Math.max(260, container.clientWidth - 32);
    const maxDisplayHeight = Math.min(520, window.innerHeight * 0.55);

    const aspect = effCrop.outW / effCrop.outH;
    let dispW = maxDisplayWidth;
    let dispH = dispW / aspect;

    if (dispH > maxDisplayHeight) {
      dispH = maxDisplayHeight;
      dispW = dispH * aspect;
    }

    // support high dpr displays
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(dispW * dpr);
    canvas.height = Math.round(dispH * dpr);
    canvas.style.width = `${Math.round(dispW)}px`;
    canvas.style.height = `${Math.round(dispH)}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // clear canvas
    ctx.clearRect(0, 0, dispW, dispH);

    // draw checkerboard background
    this.drawCheckerboard(ctx, dispW, dispH, 12);

    // build shape clipping path
    ctx.save();
    buildClipPath(ctx, 0, 0, dispW, dispH, activePreset, roundPercent);
    ctx.clip();

    // enable image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // render transformed image
    ctx.drawImage(
      this.state.image,
      effCrop.cropX, effCrop.cropY, effCrop.cropW, effCrop.cropH,
      0, 0, dispW, dispH
    );

    // draw passport face guide if active
    if (activePreset === 'passport' && showFaceGuide) {
      this.drawPassportFaceGuide(ctx, dispW, dispH);
    }

    ctx.restore(); // restore clip

    // draw shape boundary outline
    ctx.save();
    buildClipPath(ctx, 0.5, 0.5, dispW - 1, dispH - 1, activePreset, roundPercent);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // restore dpr
  }

  drawCheckerboard(ctx, w, h, size = 12) {
    ctx.save();
    const cols = Math.ceil(w / size);
    const rows = Math.ceil(h / size);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    const c1 = isLight ? '#e8e8eb' : '#141416';
    const c2 = isLight ? '#fbfbfd' : '#1e1e22';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? c1 : c2;
        ctx.fillRect(c * size, r * size, size, size);
      }
    }
    ctx.restore();
  }

  async exportPNG() {
    if (!this.state.image || this.state.isExporting) return;

    if (!this.state.isUserUploaded) {
      this.showToast('Please upload an image first to download.', 'info');
      if (this.dom.fileInput) {
        this.dom.fileInput.click();
      }
      return;
    }

    const format = this.state.exportFormat || 'webp';
    const formatLabels = {
      webp: 'WebP (~1MB)',
      png: 'Lossless PNG',
      jpeg: 'JPG'
    };

    this.state.isExporting = true;
    this.dom.downloadBtn.disabled = true;
    this.dom.downloadBtn.classList.add('loading');
    const originalText = this.dom.downloadBtn.innerHTML;
    this.dom.downloadBtn.innerHTML = `
      <span class="btn-spinner"></span> Exporting High-Res ${formatLabels[format] || 'Image'}...
    `;

    try {
      const { activePreset, roundPercent, fileName } = this.state;
      const effCrop = this.calculateEffectiveCrop();

      // offscreen canvas at full source resolution
      const offscreen = document.createElement('canvas');
      offscreen.width = effCrop.outW;
      offscreen.height = effCrop.outH;
      const ctx = offscreen.getContext('2d');

      if (!ctx) throw new Error('Could not create offscreen Canvas context.');

      if (format === 'jpeg') {
        // jpg lacks transparency, fill with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, effCrop.outW, effCrop.outH);
      } else {
        // clear to alpha 0 for png/webp
        ctx.clearRect(0, 0, effCrop.outW, effCrop.outH);
      }

      // build clipping path at full resolution
      ctx.save();
      buildClipPath(ctx, 0, 0, effCrop.outW, effCrop.outH, activePreset, roundPercent);
      ctx.clip();

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // render cropped source image
      ctx.drawImage(
        this.state.image,
        effCrop.cropX, effCrop.cropY, effCrop.cropW, effCrop.cropH,
        0, 0, effCrop.outW, effCrop.outH
      );

      ctx.restore();

      // determine output format and quality
      let mimeType = 'image/webp';
      let extension = 'webp';
      let quality = 0.94; // pristine quality matching source size

      if (format === 'jpeg') {
        mimeType = 'image/jpeg';
        extension = 'jpg';
        quality = 0.92;
      } else if (format === 'png') {
        mimeType = 'image/png';
        extension = 'png';
        quality = undefined;
      }

      // export canvas to blob
      const blob = await new Promise((resolve, reject) => {
        offscreen.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed.'));
        }, mimeType, quality);
      });

      // generate clean output filename
      const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const downloadName = `${safeName}-${activePreset}.${extension}`;

      // format human-readable file size
      const sizeStr = blob.size >= 1048576
        ? `${(blob.size / 1048576).toFixed(1)} MB`
        : `${Math.round(blob.size / 1024)} KB`;

      // trigger browser file download
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // revoke object url
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      triggerHaptic('heavy');
      const typeDesc = format === 'jpeg' ? 'JPG' : (format === 'webp' ? 'transparent WebP' : 'transparent PNG');
      this.showToast(`Downloaded ${downloadName} (${sizeStr}, ${effCrop.outW} × ${effCrop.outH} px, ${typeDesc})`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast('Export failed: ' + err.message, 'error');
    } finally {
      this.state.isExporting = false;
      this.dom.downloadBtn.classList.remove('loading');
      this.dom.downloadBtn.innerHTML = originalText;
      this.dom.downloadBtnText = document.getElementById('download-btn-text');
      this.updateDownloadBtnLabel();
      this.updateDownloadBtnState();
    }
  }
}

// initialize app when dom is ready
function startShapeMyImageApp() {
  if (!window.app) {
    try {
      window.app = new ShapeMyImageApp();
    } catch (err) {
      console.error('Failed to initialize ShapeMyImageApp:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startShapeMyImageApp);
} else {
  startShapeMyImageApp();
}
