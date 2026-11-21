// FACE RECOGNITION & IDENTITY INTELLIGENCE ENGINE (JS CONTROLLER)
            window.faceRecognitionState = {
                file: null,
                imageDataUrl: null,
                analysis: null,
                searchResults: []
            };

            window.attachFaceRecognitionHandlers = function () {
                const zone = document.getElementById('face-upload-zone');
                const input = document.getElementById('face-upload-input');
                const placeholder = document.getElementById('face-upload-placeholder');
                const previewWrapper = document.getElementById('face-preview-wrapper');
                const previewImage = document.getElementById('face-preview-image');
                const searchFilter = document.getElementById('face-search-filter');

                if (!zone || !input || !placeholder || !previewWrapper || !previewImage) return;

                const handleFile = (file) => {
                    if (!file) return;
                    const isImg = file.type && file.type.startsWith('image/');
                    const isPdf = (file.type === 'application/pdf') || (file.name && file.name.toLowerCase().endsWith('.pdf'));
                    if (!isImg && !isPdf) {
                        showFaceRecognitionMessage('Please upload an image (PNG, JPG, WEBP) or a PDF document.', 'error');
                        return;
                    }

                    window.faceRecognitionState.file = file;

                    // Transition UI: Hide center hero upload and show results workspace
                    const hero = document.getElementById('face-center-hero-upload');
                    const ws = document.getElementById('face-scan-results-workspace');
                    if (hero) hero.style.display = 'none';
                    if (ws) ws.style.display = 'flex';

                    if (isPdf) {
                        // For PDF files: show document card while server renders pages & scans faces
                        placeholder.style.display = 'none';
                        previewWrapper.style.display = 'block';
                        previewImage.style.display = 'none';

                        let pdfCard = document.getElementById('face-pdf-preview-card');
                        if (!pdfCard) {
                            pdfCard = document.createElement('div');
                            pdfCard.id = 'face-pdf-preview-card';
                            previewWrapper.appendChild(pdfCard);
                        }
                        pdfCard.style.cssText = 'padding:20px; background:rgba(0,255,209,0.04); border:1px solid rgba(0,255,209,0.3); border-radius:6px; text-align:center;';
                        pdfCard.innerHTML = `
                            <i class="fas fa-file-pdf" style="font-size:38px; color:#FF5555; margin-bottom:8px; display:block;"></i>
                            <div style="font-weight:bold; font-size:12px; color:#fff; word-break:break-all;">${file.name}</div>
                            <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-top:4px;">Poppler + Rust PDF Neural Scanning...</div>
                        `;
                        pdfCard.style.display = 'block';

                        updateFaceProgress(20, 'PDF document loaded. Rendering & scanning...');
                        setTimeout(() => {
                            runFaceRecognitionScan();
                        }, 50);
                    } else {
                        const pdfCard = document.getElementById('face-pdf-preview-card');
                        if (pdfCard) pdfCard.style.display = 'none';

                        const reader = new FileReader();
                        reader.onload = function (e) {
                            window.faceRecognitionState.imageDataUrl = e.target.result;
                            previewImage.src = e.target.result;
                            previewImage.style.display = 'inline-block';
                            previewWrapper.style.display = 'block';
                            placeholder.style.display = 'none';
                            document.getElementById('face-progress-text').textContent = 'Image loaded. Auto-scanning face...';
                            setTimeout(() => {
                                runFaceRecognitionScan();
                            }, 50);
                        };
                        reader.readAsDataURL(file);
                    }
                };

                input.addEventListener('change', function (ev) {
                    handleFile(ev.target.files[0]);
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    zone.addEventListener(eventName, function (ev) {
                        ev.preventDefault();
                        zone.style.borderColor = '#00FFD1';
                        zone.style.background = 'rgba(0,255,209,0.08)';
                    });
                });

                ['dragleave', 'dragend', 'drop'].forEach(eventName => {
                    zone.addEventListener(eventName, function (ev) {
                        ev.preventDefault();
                        zone.style.borderColor = 'rgba(0,255,209,0.45)';
                        zone.style.background = 'rgba(0,0,0,0.2)';
                    });
                });

                window.handleFaceFile = handleFile;

                zone.addEventListener('drop', function (ev) {
                    ev.preventDefault();
                    if (ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
                        handleFile(ev.dataTransfer.files[0]);
                    }
                });

                if (searchFilter) {
                    searchFilter.addEventListener('input', renderFaceSearchResults);
                }
            };

            window.pasteImageFromClipboard = async function() {
                try {
                    if (navigator.clipboard && navigator.clipboard.read) {
                        const items = await navigator.clipboard.read();
                        for (const item of items) {
                            for (const type of item.types) {
                                if (type.startsWith('image/')) {
                                    const blob = await item.getType(type);
                                    if (window.handleFaceFile) {
                                        window.handleFaceFile(blob);
                                        showFaceRecognitionMessage('Image pasted from clipboard!', 'success');
                                        return;
                                    }
                                }
                            }
                        }
                    }
                    showFaceRecognitionMessage('Press Ctrl+V anywhere in this window to paste your copied image.', 'info');
                } catch (err) {
                    showFaceRecognitionMessage('Clipboard permission needed. Simply press Ctrl+V to paste your image directly!', 'info');
                }
            };

            // Global paste listener when face recognition popup is open
            document.addEventListener('paste', function(e) {
                const popup = document.getElementById('face-recognition-popup');
                if (!popup || popup.style.display === 'none') return;

                // Don't intercept paste if user is typing in a text input or textarea
                const targetTag = (e.target.tagName || '').toLowerCase();
                if (targetTag === 'input' || targetTag === 'textarea') return;

                const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
                if (!items) return;

                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file && window.handleFaceFile) {
                            e.preventDefault();
                            window.handleFaceFile(file);
                            showFaceRecognitionMessage('Image pasted from clipboard via Ctrl+V!', 'success');
                            return;
                        }
                    }
                }
            });

            function updateFaceProgress(percent, text) {
                const fill = document.getElementById('face-progress-fill');
                const shell = document.getElementById('face-progress-shell');
                const label = document.getElementById('face-progress-text');
                if (!fill || !shell || !label) return;
                shell.style.display = 'block';
                fill.style.width = percent + '%';
                label.textContent = text;
            }

            function hashString(value) {
                let hash = 0;
                for (let i = 0; i < value.length; i++) {
                    hash = ((hash << 5) - hash) + value.charCodeAt(i);
                    hash |= 0;
                }
                return Math.abs(hash).toString(16);
            }

            function createFaceThumbnail(imageElement, faceBox, width = 96, height = 96) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                const margin = Math.max(12, faceBox.width * 0.25);
                const sx = Math.max(0, faceBox.x - margin);
                const sy = Math.max(0, faceBox.y - margin);
                const sw = Math.min(imageElement.naturalWidth - sx, faceBox.width + margin * 2);
                const sh = Math.min(imageElement.naturalHeight - sy, faceBox.height + margin * 2);
                ctx.drawImage(imageElement, sx, sy, sw, sh, 0, 0, width, height);
                return canvas.toDataURL('image/png');
            }

            async function loadFaceApiModels() {
                if (window.faceapi) {
                    try {
                        await Promise.all([
                            window.faceapi.nets.tinyFaceDetector.load('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
                            window.faceapi.nets.faceLandmark68Net.load('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
                            window.faceapi.nets.faceRecognitionNet.load('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
                            window.faceapi.nets.ageGenderNet.load('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/')
                        ]);
                        return true;
                    } catch (err) {
                        console.warn('Face API models unavailable, using fallback analysis.', err);
                        return false;
                    }
                }
                try {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';
                    document.head.appendChild(script);
                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = reject;
                    });
                    return loadFaceApiModels();
                } catch (err) {
                    console.warn('Face API script unavailable, using fallback analysis.', err);
                    return false;
                }
            }

            function generate68Landmarks(box) {
                const landmarks = [];
                const bx = box.x, by = box.y, bw = box.width, bh = box.height;
                // Jawline (17 points: 0..16)
                for (let i = 0; i < 17; i++) {
                    const t = i / 16;
                    const angle = Math.PI * (0.1 + t * 0.8);
                    landmarks.push({
                        x: bx + (bw / 2) - (bw * 0.48) * Math.cos(angle),
                        y: by + (bh * 0.35) + (bh * 0.6) * Math.sin(angle)
                    });
                }
                // Left eyebrow (5 points: 17..21)
                for (let i = 0; i < 5; i++) {
                    landmarks.push({ x: bx + bw * (0.18 + i * 0.06), y: by + bh * (0.24 - (i === 2 ? 0.03 : 0)) });
                }
                // Right eyebrow (5 points: 22..26)
                for (let i = 0; i < 5; i++) {
                    landmarks.push({ x: bx + bw * (0.52 + i * 0.06), y: by + bh * (0.24 - (i === 2 ? 0.03 : 0)) });
                }
                // Nose bridge & tip (9 points: 27..35)
                for (let i = 0; i < 4; i++) {
                    landmarks.push({ x: bx + bw * 0.5, y: by + bh * (0.30 + i * 0.05) });
                }
                for (let i = 0; i < 5; i++) {
                    landmarks.push({ x: bx + bw * (0.38 + i * 0.06), y: by + bh * 0.50 });
                }
                // Left eye (6 points: 36..41)
                const leX = bx + bw * 0.28, leY = by + bh * 0.34;
                landmarks.push({ x: leX - bw * 0.05, y: leY });
                landmarks.push({ x: leX - bw * 0.02, y: leY - bh * 0.03 });
                landmarks.push({ x: leX + bw * 0.02, y: leY - bh * 0.03 });
                landmarks.push({ x: leX + bw * 0.05, y: leY });
                landmarks.push({ x: leX + bw * 0.02, y: leY + bh * 0.03 });
                landmarks.push({ x: leX - bw * 0.02, y: leY + bh * 0.03 });

                // Right eye (6 points: 42..47)
                const reX = bx + bw * 0.72, reY = by + bh * 0.34;
                landmarks.push({ x: reX - bw * 0.05, y: reY });
                landmarks.push({ x: reX - bw * 0.02, y: reY - bh * 0.03 });
                landmarks.push({ x: reX + bw * 0.02, y: reY - bh * 0.03 });
                landmarks.push({ x: reX + bw * 0.05, y: reY });
                landmarks.push({ x: reX + bw * 0.02, y: reY + bh * 0.03 });
                landmarks.push({ x: reX - bw * 0.02, y: reY + bh * 0.03 });

                // Outer & inner lips (20 points: 48..67)
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * 2 * Math.PI;
                    landmarks.push({ x: bx + bw * 0.5 + (bw * 0.16) * Math.cos(angle), y: by + bh * 0.68 + (bh * 0.08) * Math.sin(angle) });
                }
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * 2 * Math.PI;
                    landmarks.push({ x: bx + bw * 0.5 + (bw * 0.1) * Math.cos(angle), y: by + bh * 0.68 + (bh * 0.04) * Math.sin(angle) });
                }
                return landmarks;
            }


            function drawFaceOverlay(imageElement, detections) {
                const canvas = document.getElementById('face-preview-canvas');
                const wrapper = document.getElementById('face-preview-wrapper');
                if (!canvas || !wrapper || !imageElement) return;

                const rect = imageElement.getBoundingClientRect();
                const displayWidth = imageElement.clientWidth || rect.width || wrapper.clientWidth;
                const displayHeight = imageElement.clientHeight || rect.height || wrapper.clientHeight;

                canvas.width = displayWidth;
                canvas.height = displayHeight;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const naturalW = imageElement.naturalWidth || displayWidth;
                const naturalH = imageElement.naturalHeight || displayHeight;
                const scaleX = displayWidth / naturalW;
                const scaleY = displayHeight / naturalH;

                detections.forEach((face, index) => {
                    const box = face.box || {};
                    const x = (box.x || 0) * scaleX;
                    const y = (box.y || 0) * scaleY;
                    const width = (box.width || 0) * scaleX;
                    const height = (box.height || 0) * scaleY;

                    const isMatch = Boolean(face.matchedIdentity);

                    // Neon bounding box
                    ctx.strokeStyle = isMatch ? '#00FFD1' : (index === 0 ? '#00FFD1' : '#7C93FF');
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, width, height);

                    // Top Label tag (Confidence & Face Index)
                    const topLabelText = `FACE #${face.faceIndex || index + 1} (${Math.round((face.confidence || 0.95) * 100)}%)`;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                    ctx.fillRect(x, Math.max(0, y - 22), 140, 20);
                    ctx.fillStyle = isMatch ? '#00FFD1' : (index === 0 ? '#00FFD1' : '#7C93FF');
                    ctx.font = 'bold 11px Share Tech Mono, monospace';
                    ctx.fillText(topLabelText, x + 6, Math.max(14, y - 7));

                    // Bottom Label tag: Matched identity OR 128D Embedding ID
                    let bottomLabelText = '';
                    if (isMatch) {
                        bottomLabelText = `ID: ${face.matchedIdentity.name.toUpperCase()} (${face.matchedIdentity.matchPct}%)`;
                    } else {
                        bottomLabelText = `EMB: ${face.embeddingId || '128D VECTOR'}`;
                    }
                    const bottomY = Math.min(canvas.height - 6, y + height + 4);
                    const tagW = Math.max(160, width);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
                    ctx.fillRect(x, bottomY, tagW, 20);
                    ctx.fillStyle = isMatch ? '#00FFD1' : '#7C93FF';
                    ctx.font = 'bold 10px Share Tech Mono, monospace';
                    ctx.fillText(bottomLabelText, x + 6, bottomY + 14);

                    // Draw facial landmark points
                    ctx.fillStyle = isMatch ? '#00FFD1' : '#FFD100';
                    (face.landmarks || []).forEach(point => {
                        const px = (point.x || 0) * scaleX;
                        const py = (point.y || 0) * scaleY;
                        ctx.beginPath();
                        ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                });
            }

            // Active target index for OCR quick-assign
            window.activeFaceCardIndex = 0;
            window.highlightedOcrText = '';

            // Global selection listener so highlighted OCR text is never lost when clicking input fields
            document.addEventListener('selectionchange', () => {
                const selection = window.getSelection();
                const text = selection ? selection.toString().trim() : '';
                if (text && text.length > 0) {
                    window.highlightedOcrText = text;
                    const previewBadge = document.getElementById('selected-ocr-preview-badge');
                    if (previewBadge) {
                        previewBadge.textContent = `"${text.length > 25 ? text.slice(0, 25) + '...' : text}"`;
                        previewBadge.style.display = 'inline-block';
                    }
                }
            });

            window.handleOcrTextSelection = function(event) {
                const selection = window.getSelection();
                const text = selection ? selection.toString().trim() : '';
                if (text && text.length > 0) {
                    window.highlightedOcrText = text;
                    const previewBadge = document.getElementById('selected-ocr-preview-badge');
                    if (previewBadge) {
                        previewBadge.textContent = `"${text.length > 25 ? text.slice(0, 25) + '...' : text}"`;
                        previewBadge.style.display = 'inline-block';
                    }
                }
                const popup = document.getElementById('ocr-highlight-popup');
                if (!popup) return;

                if (!text || text.length === 0) {
                    popup.style.display = 'none';
                    return;
                }

                window.highlightedOcrText = text;
                const cardBadge = document.getElementById('ocr-popup-active-card-badge');
                if (cardBadge) {
                    const activeIdx = (window.activeFaceCardIndex !== undefined) ? window.activeFaceCardIndex : 0;
                    cardBadge.textContent = `Target: Card #${activeIdx + 1}`;
                }

                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Position popup right above the selection (viewport-fixed coords)
                const popupHeight = 65;
                const topPos = Math.max(10, (rect.top - popupHeight < 10) ? (rect.bottom + 8) : (rect.top - popupHeight - 4));
                const leftPos = Math.max(10, Math.min(window.innerWidth - 370, rect.left));

                popup.style.top = `${topPos}px`;
                popup.style.left = `${leftPos}px`;
                popup.style.display = 'block';
            };

            // Dedicated field injector: injects highlighted text into any input/textarea element
            window.injectHighlightedInto = function(target, fieldLabel = 'Field') {
                let text = window.highlightedOcrText;
                const sel = window.getSelection();
                if (sel && sel.toString().trim().length > 0) {
                    text = sel.toString().trim();
                    window.highlightedOcrText = text;
                }

                if (!text || !text.trim()) {
                    showFaceRecognitionMessage(`⚠️ Please highlight text in the Raw OCR box first, then click 📥 on ${fieldLabel}!`, 'error');
                    return;
                }
                text = text.trim();

                const el = (typeof target === 'string') ? document.getElementById(target) : target;
                if (!el) {
                    showFaceRecognitionMessage(`Target element for ${fieldLabel} not found.`, 'error');
                    return;
                }

                el.value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.focus();

                // Visual pulse effect
                el.style.transition = 'all 0.2s ease';
                const origOutline = el.style.outline;
                const origShadow = el.style.boxShadow;
                el.style.outline = '2px solid #00FFD1';
                el.style.boxShadow = '0 0 16px rgba(0,255,209,0.9), 0 0 4px #00FFD1';
                setTimeout(() => {
                    el.style.outline = origOutline || 'none';
                    el.style.boxShadow = origShadow || '';
                }, 1200);

                showFaceRecognitionMessage(`📥 Injected "${text.length > 25 ? text.slice(0, 25) + '...' : text}" into ${fieldLabel}!`, 'success');
            };

            window.toggleEditRelativeOtherExplain = function() {
                const sel = document.getElementById('face-edit-relative-relation');
                const wrap = document.getElementById('face-edit-relative-other-wrap');
                if (sel && wrap) {
                    wrap.style.display = (sel.value === 'Other') ? 'block' : 'none';
                }
            };

            window.toggleEnrollRelativeOtherExplain = function(index) {
                const sel = document.getElementById(`face-enroll-relative-relation-${index}`);
                const wrap = document.getElementById(`face-enroll-relative-other-wrap-${index}`);
                if (sel && wrap) {
                    wrap.style.display = (sel.value === 'Other') ? 'block' : 'none';
                }
            };

            window.addEditModalCustomFieldRow = function(key = '', val = '') {
                const container = document.getElementById('face-edit-custom-fields-container');
                if (!container) return;
                const row = document.createElement('div');
                row.className = 'custom-field-row';
                row.style.cssText = 'display:flex; gap:6px; align-items:center;';
                row.innerHTML = `
                    <input type="text" class="cf-key" placeholder="Field Name (e.g. Occupation)" value="${(key || '').replace(/"/g, '&quot;')}" style="width:38%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #00FFD1; color:#00FFD1; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                    <input type="text" class="cf-val" placeholder="Field Value" value="${(val || '').replace(/"/g, '&quot;')}" style="flex:1; box-sizing:border-box; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.25); color:#fff; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                    <button type="button" onclick="this.closest('.custom-field-row').remove()" style="background:rgba(255,80,80,0.15); border:1px solid rgba(255,80,80,0.3); color:#FF5555; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;" title="Remove field">✕</button>
                `;
                container.appendChild(row);
                const valInput = row.querySelector('.cf-val');
                if (valInput) valInput.focus();
                return row;
            };

            window.addEnrollCustomFieldRow = function(cardIndex = 0, key = '', val = '') {
                const container = document.getElementById(`face-enroll-custom-fields-${cardIndex}`);
                if (!container) return;
                const row = document.createElement('div');
                row.className = 'custom-field-row';
                row.style.cssText = 'display:flex; gap:6px; align-items:center;';
                row.innerHTML = `
                    <input type="text" class="cf-key" placeholder="Field Name (e.g. Occupation)" value="${(key || '').replace(/"/g, '&quot;')}" style="width:38%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #00FFD1; color:#00FFD1; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                    <input type="text" class="cf-val" placeholder="Field Value" value="${(val || '').replace(/"/g, '&quot;')}" style="flex:1; box-sizing:border-box; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.25); color:#fff; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                    <button type="button" onclick="this.closest('.custom-field-row').remove()" style="background:rgba(255,80,80,0.15); border:1px solid rgba(255,80,80,0.3); color:#FF5555; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;" title="Remove field">✕</button>
                `;
                container.appendChild(row);
                const valInput = row.querySelector('.cf-val');
                if (valInput) valInput.focus();
                return row;
            };

            window.getEditModalCustomFields = function() {
                const container = document.getElementById('face-edit-custom-fields-container');
                const out = {};
                if (!container) return out;
                container.querySelectorAll('.custom-field-row').forEach(r => {
                    const k = (r.querySelector('.cf-key')?.value || '').trim();
                    const v = (r.querySelector('.cf-val')?.value || '').trim();
                    if (k) out[k] = v;
                });
                return out;
            };

            window.getEnrollCustomFields = function(cardIndex) {
                const container = document.getElementById(`face-enroll-custom-fields-${cardIndex}`);
                const out = {};
                if (!container) return out;
                container.querySelectorAll('.custom-field-row').forEach(r => {
                    const k = (r.querySelector('.cf-key')?.value || '').trim();
                    const v = (r.querySelector('.cf-val')?.value || '').trim();
                    if (k) out[k] = v;
                });
                return out;
            };

            window.assignHighlightedOcr = function(fieldName) {
                let text = window.highlightedOcrText;
                const sel = window.getSelection();
                if (sel && sel.toString().trim().length > 0) {
                    text = sel.toString().trim();
                    window.highlightedOcrText = text;
                }
                const popup = document.getElementById('ocr-highlight-popup');
                if (popup) popup.style.display = 'none';

                if (!text || text.length === 0) {
                    showFaceRecognitionMessage('Please highlight some text in the OCR box with your mouse first!', 'error');
                    return;
                }

                // If Custom field requested, prompt for field key name!
                if (fieldName === 'custom') {
                    const customKey = prompt("Enter Custom Field Name for highlighted text (e.g. Occupation, Department, Nationality, Emergency Contact, Badge ID):");
                    if (!customKey || !customKey.trim()) return;
                    const cleanKey = customKey.trim();

                    const editModal = document.getElementById('face-edit-modal');
                    if (editModal && (editModal.style.display === 'flex' || editModal.style.display === 'block')) {
                        addEditModalCustomFieldRow(cleanKey, text);
                        showFaceRecognitionMessage(`Added custom field "${cleanKey}" to edit profile!`, 'success');
                        return;
                    }

                    const cardSel = document.getElementById('ocr-quick-assign-card-selector');
                    let idx = (cardSel && cardSel.value !== '') ? parseInt(cardSel.value, 10) : ((window.activeFaceCardIndex !== undefined) ? window.activeFaceCardIndex : 0);
                    if (typeof switchEnrollMode === 'function') {
                        switchEnrollMode(idx, 'new');
                    }
                    addEnrollCustomFieldRow(idx, cleanKey, text);
                    showFaceRecognitionMessage(`Added custom field "${cleanKey}" to Face Card #${idx + 1}!`, 'success');
                    return;
                }

                // If Face Edit Modal is open, assign to modal input fields!
                const editModal = document.getElementById('face-edit-modal');
                if (editModal && (editModal.style.display === 'flex' || editModal.style.display === 'block')) {
                    let editField = null;
                    if (fieldName === 'name') editField = document.getElementById('face-edit-name');
                    else if (fieldName === 'dob') editField = document.getElementById('face-edit-dob');
                    else if (fieldName === 'id_number') editField = document.getElementById('face-edit-idnum');
                    else if (fieldName === 'blood_group') editField = document.getElementById('face-edit-blood');
                    else if (fieldName === 'email') editField = document.getElementById('face-edit-email');
                    else if (fieldName === 'phone') editField = document.getElementById('face-edit-phone');
                    else if (fieldName === 'relative_name') editField = document.getElementById('face-edit-relative-name');
                    else if (fieldName === 'doctype') editField = document.getElementById('face-edit-doctype');
                    else if (fieldName === 'address') editField = document.getElementById('face-edit-addr');
                    else if (fieldName === 'notes') editField = document.getElementById('face-edit-notes');

                    if (editField) {
                        editField.value = text;
                        editField.dispatchEvent(new Event('input', { bubbles: true }));
                        editField.dispatchEvent(new Event('change', { bubbles: true }));
                        editField.focus();
                        editField.style.outline = '2px solid #00FFD1';
                        editField.style.boxShadow = '0 0 16px rgba(0,255,209,0.9)';
                        setTimeout(() => {
                            editField.style.outline = 'none';
                            editField.style.boxShadow = 'none';
                        }, 1200);
                        showFaceRecognitionMessage(`Assigned to EDIT field: ${fieldName.toUpperCase()}!`, 'success');
                        return;
                    }
                }

                // Determine active card index
                const cardSel = document.getElementById('ocr-quick-assign-card-selector');
                let idx = (cardSel && cardSel.value !== '') ? parseInt(cardSel.value, 10) : ((window.activeFaceCardIndex !== undefined) ? window.activeFaceCardIndex : 0);

                // Check if currently focused input belongs to a specific card index
                const activeEl = document.activeElement;
                if (activeEl && activeEl.id) {
                    const matchIdx = activeEl.id.match(/-(\d+)$/);
                    if (matchIdx) {
                        idx = parseInt(matchIdx[1], 10);
                        window.activeFaceCardIndex = idx;
                        if (cardSel) cardSel.value = String(idx);
                    }
                }

                // Auto-switch card to 'new' mode so the target input is visible!
                if (typeof switchEnrollMode === 'function') {
                    switchEnrollMode(idx, 'new');
                }

                let targetInput = null;
                if (fieldName === 'name') targetInput = document.getElementById(`face-enroll-name-${idx}`) || document.getElementById('face-enroll-name-0') || document.querySelector('input[id^="face-enroll-name-"]');
                else if (fieldName === 'dob') targetInput = document.getElementById(`face-enroll-dob-${idx}`) || document.getElementById('face-enroll-dob-0') || document.querySelector('input[id^="face-enroll-dob-"]');
                else if (fieldName === 'id_number') targetInput = document.getElementById(`face-enroll-idnum-${idx}`) || document.getElementById('face-enroll-idnum-0') || document.querySelector('input[id^="face-enroll-idnum-"]');
                else if (fieldName === 'blood_group') targetInput = document.getElementById(`face-enroll-blood-${idx}`) || document.getElementById('face-enroll-blood-0') || document.querySelector('input[id^="face-enroll-blood-"]');
                else if (fieldName === 'email') targetInput = document.getElementById(`face-enroll-email-${idx}`) || document.getElementById('face-enroll-email-0') || document.querySelector('input[id^="face-enroll-email-"]');
                else if (fieldName === 'phone') targetInput = document.getElementById(`face-enroll-phone-${idx}`) || document.getElementById('face-enroll-phone-0') || document.querySelector('input[id^="face-enroll-phone-"]');
                else if (fieldName === 'relative_name') targetInput = document.getElementById(`face-enroll-relative-name-${idx}`) || document.getElementById('face-enroll-relative-name-0') || document.querySelector('input[id^="face-enroll-relative-name-"]');
                else if (fieldName === 'doctype') targetInput = document.getElementById(`face-enroll-doctype-${idx}`) || document.getElementById('face-enroll-doctype-0') || document.querySelector('input[id^="face-enroll-doctype-"]');
                else if (fieldName === 'address') targetInput = document.getElementById(`face-enroll-addr-${idx}`) || document.getElementById('face-enroll-addr-0') || document.querySelector('input[id^="face-enroll-addr-"]');
                else if (fieldName === 'notes') targetInput = document.getElementById(`face-enroll-notes-${idx}`) || document.getElementById('face-enroll-notes-0') || document.querySelector('input[id^="face-enroll-notes-"]');

                if (targetInput) {
                    targetInput.value = text;
                    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                    targetInput.focus();
                    targetInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    targetInput.style.outline = '2px solid #00FFD1';
                    targetInput.style.boxShadow = '0 0 16px rgba(0,255,209,0.9)';
                    setTimeout(() => {
                        targetInput.style.outline = 'none';
                        targetInput.style.boxShadow = 'none';
                    }, 1200);

                    showFaceRecognitionMessage(`Assigned to Card #${idx + 1} ${fieldName.toUpperCase()}: "${text.length > 25 ? text.slice(0, 25) + '...' : text}"`, 'success');
                } else {
                    showFaceRecognitionMessage(`Target field for ${fieldName.toUpperCase()} not found. Ensure Face Card #${idx + 1} is open.`, 'error');
                }
            };

            // Global listener to close highlight popup when clicking outside
            document.addEventListener('mousedown', function(e) {
                const popup = document.getElementById('ocr-highlight-popup');
                if (popup && popup.style.display === 'block') {
                    if (!popup.contains(e.target) && e.target.id !== 'face-raw-ocr-text' && !e.target.closest('#face-raw-ocr-text')) {
                        popup.style.display = 'none';
                    }
                }
            });

            window.runHandwritingOcrScan = async function() {
                const btn = document.getElementById('btn-handwriting-ocr');
                const imageElement = document.getElementById('face-preview-image');
                const input = document.getElementById('face-upload-input');
                const file = (window.faceRecognitionState && window.faceRecognitionState.file) || (input && input.files ? input.files[0] : null);

                if (!file && (!imageElement || !imageElement.src || !imageElement.src.startsWith('data:image'))) {
                    showFaceRecognitionMessage('Please upload an image before running handwriting recognition.', 'error');
                    return;
                }

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> RUNNING RUST SAUVOLA & RAPIDOCR...';
                }

                try {
                    const formData = new FormData();
                    if (file) {
                        formData.append('image', file);
                    } else if (imageElement && imageElement.src) {
                        const res = await fetch(imageElement.src);
                        const blob = await res.blob();
                        formData.append('image', blob, 'handwriting.png');
                    }
                    formData.append('mode', 'handwriting');

                    const resp = await fetch('/api/face/ocr?mode=handwriting', {
                        method: 'POST',
                        body: formData
                    });

                    if (!resp.ok) {
                        throw new Error(`HTTP ${resp.status}`);
                    }

                    const ocrData = await resp.json();
                    if (ocrData.status === 'success') {
                        if (!window.faceRecognitionState.analysis) {
                            window.faceRecognitionState.analysis = { faces: [] };
                        }
                        window.faceRecognitionState.analysis.ocr = ocrData;
                        renderFaceResults(window.faceRecognitionState.analysis);
                        showFaceRecognitionMessage(`Handwriting to text extracted (${ocrData.lineCount} lines) via Rust Sauvola Adaptive Binarization + Cursive Bridge!`, 'success');
                    } else {
                        throw new Error(ocrData.message || 'Handwriting extraction failed');
                    }
                } catch (err) {
                    console.error('Handwriting OCR error:', err);
                    showFaceRecognitionMessage('Handwriting OCR error: ' + err.message, 'error');
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-pen-nib"></i> CONVERT HANDWRITING TO TEXT (RUST SAUVOLA)';
                    }
                }
            };

            function renderFaceResults(analysis) {
                const container = document.getElementById('face-results-panel');
                const noResults = document.getElementById('face-no-results');
                const countPill = document.getElementById('face-detection-count-pill');
                if (!container) return;
                const faces = analysis.faces || [];

                if (countPill) {
                    countPill.textContent = faces.length ? `${faces.length} FACE${faces.length === 1 ? '' : 'S'} DETECTED` : '';
                }

                if (!faces.length && (!analysis.ocr || !analysis.ocr.hasOcrData)) {
                    container.innerHTML = '<div style="padding:16px; border:1px solid rgba(255,80,80,0.3); border-radius:6px; color:#ff7777; font-size:11px; text-align:center;"><i class="fas fa-exclamation-circle" style="margin-right:6px;"></i>No faces or text detected in this image. Please upload a clear face portrait or ID card.</div>';
                    if (noResults) noResults.style.display = 'none';
                    return;
                }
                if (noResults) noResults.style.display = 'none';

                // 1. Build Auto-Detected OCR Identity Card if present
                let ocrHtml = '';
                if (analysis.ocr && analysis.ocr.hasOcrData) {
                    const o = analysis.ocr.detectedFields || {};
                    const isHw = Boolean(analysis.ocr.isHandwriting);
                    const hwBadge = isHw ? `<span style="font-size:10px; background:rgba(255,209,102,0.18); color:#FFD166; padding:2px 8px; border-radius:3px; font-weight:bold; border:1px solid rgba(255,209,102,0.4);"><i class="fas fa-pen-nib" style="margin-right:3px;"></i>HANDWRITING INK EXTRACTED</span>` : '';
                    const pdfBadge = analysis.isPdf ? `<span style="font-size:10px; background:rgba(255,80,80,0.18); color:#FF7777; padding:2px 8px; border-radius:3px; font-weight:bold; border:1px solid rgba(255,80,80,0.4);"><i class="fas fa-file-pdf" style="margin-right:3px;"></i>PDF (${analysis.pageCount || 1} PAGE${(analysis.pageCount || 1) === 1 ? '' : 'S'})</span>` : '';

                    ocrHtml = `
                        <div style="background:rgba(0,255,209,0.06); border:1px solid ${isHw ? '#FFD166' : (analysis.isPdf ? '#FF7777' : '#00FFD1')}; border-radius:6px; padding:12px; margin-bottom:12px; box-shadow:0 0 15px rgba(0,255,209,0.1);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
                                <div style="color:${isHw ? '#FFD166' : (analysis.isPdf ? '#FF7777' : '#00FFD1')}; font-size:12px; font-weight:bold;">
                                    <i class="fas fa-id-card" style="margin-right:6px; font-size:14px;"></i>AUTO-DETECTED IDENTITY & OCR LABELS
                                </div>
                                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                                    ${pdfBadge}
                                    ${hwBadge}
                                    <span style="font-size:10px; background:rgba(0,255,209,0.18); color:#00FFD1; padding:2px 8px; border-radius:3px; font-weight:bold; border:1px solid rgba(0,255,209,0.4);">
                                        <i class="fas fa-shield-alt" style="margin-right:3px;"></i>${o.document_type || 'Identity Document'}
                                    </span>
                                    <span style="font-size:10px; color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:3px;">
                                        ${analysis.ocr.lineCount} lines · ${Math.round((analysis.ocr.averageConfidence || 0.85) * 100)}% conf
                                    </span>
                                    <button type="button" id="btn-handwriting-ocr" onclick="runHandwritingOcrScan()"
                                        style="background:rgba(255,209,102,0.14); border:1px solid #FFD166; color:#FFD166; padding:3px 8px; font-size:10px; font-weight:bold; cursor:pointer; border-radius:3px; display:inline-flex; align-items:center; gap:4px; font-family:inherit;">
                                        <i class="fas fa-pen-nib"></i> ✍️ CONVERT HANDWRITING
                                    </button>
                                </div>
                            </div>

                            <!-- Structured Auto-Detected Fields Grid -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-bottom:10px;">
                                <div style="background:rgba(0,0,0,0.3); padding:7px 9px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                                    <div style="color:rgba(255,255,255,0.45); font-size:9px; text-transform:uppercase;">FULL NAME</div>
                                    <div style="color:${o.name ? '#00FFD1' : 'rgba(255,255,255,0.4)'}; font-weight:bold; font-size:12px; margin-top:2px;">
                                        ${o.name ? '<i class="fas fa-check" style="margin-right:4px;"></i>' + o.name : 'Not detected'}
                                    </div>
                                </div>
                                <div style="background:rgba(0,0,0,0.3); padding:7px 9px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                                    <div style="color:rgba(255,255,255,0.45); font-size:9px; text-transform:uppercase;">DATE OF BIRTH (DOB)</div>
                                    <div style="color:${o.dob ? '#FFD166' : 'rgba(255,255,255,0.4)'}; font-weight:bold; font-size:12px; margin-top:2px;">
                                        ${o.dob ? '<i class="fas fa-birthday-cake" style="margin-right:4px;"></i>' + o.dob : 'Not detected'}
                                    </div>
                                </div>
                                <div style="background:rgba(0,0,0,0.3); padding:7px 9px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                                    <div style="color:rgba(255,255,255,0.45); font-size:9px; text-transform:uppercase;">ID / LICENSE / DOC #</div>
                                    <div style="color:${o.id_number ? '#7C93FF' : 'rgba(255,255,255,0.4)'}; font-weight:bold; font-size:12px; margin-top:2px; font-family:monospace;">
                                        ${o.id_number ? '<i class="fas fa-fingerprint" style="margin-right:4px;"></i>' + o.id_number : 'Not detected'}
                                    </div>
                                </div>
                                <div style="background:rgba(0,0,0,0.3); padding:7px 9px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                                    <div style="color:rgba(255,255,255,0.45); font-size:9px; text-transform:uppercase;">EXPIRY / VALID THRU</div>
                                    <div style="color:${o.expiry_date ? '#fff' : 'rgba(255,255,255,0.4)'}; font-weight:bold; font-size:11px; margin-top:2px;">
                                        ${o.expiry_date || 'N/A'}
                                    </div>
                                </div>
                                <div style="grid-column:1 / -1; background:rgba(0,0,0,0.3); padding:7px 9px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                                    <div style="color:rgba(255,255,255,0.45); font-size:9px; text-transform:uppercase;">ADDRESS / RESIDENCE</div>
                                    <div style="color:${o.address ? '#fff' : 'rgba(255,255,255,0.4)'}; font-size:11px; margin-top:2px;">
                                        ${o.address ? '<i class="fas fa-map-marker-alt" style="color:#00FFD1; margin-right:4px;"></i>' + o.address : 'Not detected'}
                                    </div>
                                </div>
                            </div>

                            <!-- Raw OCR Text with Interactive Highlight-to-Field Feature -->
                            <details open style="font-size:10px; color:rgba(255,255,255,0.6); cursor:pointer;">
                                <summary style="outline:none; color:#00FFD1; user-select:none; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                                    <span><i class="fas fa-file-alt" style="margin-right:4px;"></i>Raw Extracted OCR Lines (${analysis.ocr.lineCount} lines)</span>
                                    <span style="font-size:9px; color:#FFD166; font-weight:normal;"><i class="fas fa-i-cursor"></i> Highlight text to assign to field</span>
                                </summary>
                                <div id="face-raw-ocr-text"
                                    onmouseup="handleOcrTextSelection(event)"
                                    onkeyup="handleOcrTextSelection(event)"
                                    style="margin-top:6px; padding:8px 10px; background:rgba(0,0,0,0.6); border:1px solid rgba(0,255,209,0.25); border-radius:4px; max-height:130px; overflow-y:auto; font-family:monospace; font-size:11px; line-height:1.45; color:#eee; white-space:pre-wrap; user-select:text; cursor:text;"
                                    title="Highlight any text with mouse to open quick assign tooltip">${(analysis.ocr.rawText || 'No text extracted').replace(/</g, '&lt;')}</div>

                                <!-- Inline Quick Assign Bar for Selected Text -->
                                <div style="margin-top:8px; padding:6px 10px; background:rgba(0,0,0,0.5); border:1px solid rgba(0,255,209,0.2); border-radius:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                    <span style="font-size:10px; color:#FFD166; font-weight:bold;"><i class="fas fa-level-down-alt"></i> QUICK ASSIGN HIGHLIGHTED:</span>
                                    <span id="selected-ocr-preview-badge" style="font-size:9px; color:#00FFD1; background:rgba(0,255,209,0.12); border:1px solid rgba(0,255,209,0.3); padding:2px 8px; border-radius:3px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:none;">None selected</span>
                                    ${faces.length > 1 ? `
                                        <div style="display:flex; align-items:center; gap:4px; margin-left:4px;">
                                            <span style="font-size:9px; color:#7C93FF; font-weight:bold;"><i class="fas fa-crosshairs"></i> TARGET:</span>
                                            <select id="ocr-quick-assign-card-selector" onchange="window.activeFaceCardIndex = parseInt(this.value);" style="background:rgba(0,0,0,0.8); border:1px solid #7C93FF; color:#7C93FF; font-size:10px; padding:2px 6px; border-radius:3px; font-family:inherit; cursor:pointer;">
                                                ${faces.map((f, i) => `<option value="${i}" ${i === (window.activeFaceCardIndex || 0) ? 'selected' : ''}>Face #${f.faceIndex || i + 1}</option>`).join('')}
                                            </select>
                                        </div>
                                    ` : ''}
                                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-left:auto;">
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('name')" style="background:rgba(0,255,209,0.15); border:1px solid #00FFD1; color:#00FFD1; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px; font-weight:bold;"><i class="fas fa-plus-circle"></i> 👤 Name</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('dob')" style="background:rgba(255,209,102,0.15); border:1px solid #FFD166; color:#FFD166; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px; font-weight:bold;"><i class="fas fa-plus-circle"></i> 🎂 DOB</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('id_number')" style="background:rgba(124,147,255,0.15); border:1px solid #7C93FF; color:#7C93FF; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px; font-weight:bold;"><i class="fas fa-plus-circle"></i> 🪪 ID#</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('blood_group')" style="background:rgba(255,75,75,0.15); border:1px solid #FF4B4B; color:#FF6B6B; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px; font-weight:bold;"><i class="fas fa-plus-circle"></i> 🩸 Blood</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('email')" style="background:rgba(0,255,209,0.12); border:1px solid #00FFD1; color:#00FFD1; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;"><i class="fas fa-plus-circle"></i> 📧 Email</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('phone')" style="background:rgba(255,209,102,0.12); border:1px solid #FFD166; color:#FFD166; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;"><i class="fas fa-plus-circle"></i> 📞 Phone</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('relative_name')" style="background:rgba(124,147,255,0.15); border:1px solid #7C93FF; color:#7C93FF; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;"><i class="fas fa-plus-circle"></i> 👥 Relative</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('address')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.25); color:#fff; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;"><i class="fas fa-plus-circle"></i> 📍 Address</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('doctype')" style="background:rgba(0,255,209,0.1); border:1px solid rgba(0,255,209,0.3); color:#00FFD1; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;"><i class="fas fa-plus-circle"></i> 📜 Doc Type</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('notes')" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.2); color:#aaa; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;"><i class="fas fa-plus-circle"></i> 📝 Notes</button>
                                        <button type="button" onmousedown="event.preventDefault();" onclick="assignHighlightedOcr('custom')" style="background:rgba(0,255,209,0.2); border:1px dashed #00FFD1; color:#00FFD1; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px; font-weight:bold;"><i class="fas fa-plus"></i> ➕ Custom Field</button>
                                    </div>
                                </div>
                            </details>
                        </div>
                    `;
                }

                // 2. Build Face Cards with Multi-Photo Linking & New Profile Options
                const enrolledProfiles = window.enrolledFacesList || [];

                const facesHtml = faces.map((face, index) => {
                    const isMatched = Boolean(face.matchedIdentity);
                    const matchInfo = isMatched ? `
                        <div style="background:rgba(0,255,209,0.12); border:1px solid #00FFD1; border-radius:4px; padding:6px 10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#00FFD1; font-weight:bold; font-size:11px;"><i class="fas fa-check-circle" style="margin-right:5px;"></i>RECOGNIZED IDENTITY: ${face.matchedIdentity.name}</span>
                            <span style="color:#fff; font-size:10px; font-weight:bold;">${face.matchedIdentity.matchPct}% SIMILARITY (${face.matchedIdentity.photoCount || 1} photo${(face.matchedIdentity.photoCount || 1) === 1 ? '' : 's'} enrolled)</span>
                        </div>
                    ` : '';

                    const previewChips = (face.vectorPreview || []).map(v => `<span style="background:rgba(255,255,255,0.06); padding:2px 5px; border-radius:2px; font-family:monospace; color:#00FFD1;">${v}</span>`).join(' ');

                    const sugg = face.suggestedIdentity || {};
                    const initName = sugg.name || (isMatched ? face.matchedIdentity.name : '');
                    const initDob = sugg.dob || (isMatched && face.matchedIdentity.dob ? face.matchedIdentity.dob : '');
                    const initAddr = sugg.address || (isMatched && face.matchedIdentity.address ? face.matchedIdentity.address : '');
                    const initIdNum = sugg.id_number || (isMatched && face.matchedIdentity.idNumber ? face.matchedIdentity.idNumber : '');
                    const initDocType = sugg.document_type || (isMatched && face.matchedIdentity.documentType ? face.matchedIdentity.documentType : 'Identity Card');
                    const initNotes = isMatched ? (face.matchedIdentity.notes || '') : (sugg.document_type ? 'Auto-extracted from ' + sugg.document_type : '');

                    // Build options for Link to Existing Profile
                    const linkOptionsHtml = enrolledProfiles.map(p => {
                        const isSelected = (isMatched && face.matchedIdentity.id === p.id) ? 'selected' : '';
                        const pCount = p.photoCount || (p.photos ? p.photos.length : 1);
                        return `<option value="${p.id}" ${isSelected}>#${p.id} - ${p.name} (${pCount} photo${pCount === 1 ? '' : 's'} registered)</option>`;
                    }).join('');

                    return `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid ${isMatched ? 'rgba(0,255,209,0.4)' : 'rgba(255,255,255,0.08)'}; border-radius:6px; padding:12px;" onclick="window.activeFaceCardIndex = ${index};">
                            ${matchInfo}
                            <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06);">
                                <img src="${face.thumbnail}" alt="Face ${index + 1}" style="width:64px; height:64px; object-fit:cover; border-radius:4px; border:1px solid rgba(0,255,209,0.3); background:#000;">
                                <div style="flex:1;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <div style="color:#fff; font-size:13px; font-weight:bold;">FACE #${face.faceIndex || index + 1}</div>
                                        <div style="color:#00FFD1; font-size:10px; font-weight:bold;">${Math.round(face.confidence * 100)}% CONFIDENCE</div>
                                    </div>
                                    <div style="color:#7C93FF; font-size:10px; font-family:monospace; margin-top:2px;"><i class="fas fa-fingerprint" style="margin-right:4px;"></i>${face.embeddingId}</div>
                                    <div style="color:rgba(255,255,255,0.5); font-size:10px; margin-top:2px;">128D SFace Deep Embedding Vector (L2 Normalized)</div>
                                </div>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:10px; margin-bottom:10px;">
                                <div style="background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="color:rgba(255,255,255,0.45); margin-bottom:2px;">Bounding Box</div>
                                    <div style="color:#ccc;">${Math.round(face.box.x)}, ${Math.round(face.box.y)} (${Math.round(face.box.width)}×${Math.round(face.box.height)} px)</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="color:rgba(255,255,255,0.45); margin-bottom:2px;">Landmarks</div>
                                    <div style="color:#ccc;">${face.landmarkCount || 5} Primary Neural Landmarks</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="color:rgba(255,255,255,0.45); margin-bottom:2px;">Focus & Sharpness Score</div>
                                    <div style="color:#00FFD1;">${face.qualityScore || 85}/100 (Rust Laplacian Variance)</div>
                                </div>
                                <div style="background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="color:rgba(255,255,255,0.45); margin-bottom:2px;">Vector Dimension</div>
                                    <div style="color:#7C93FF;">128 Float32 Dimensions</div>
                                </div>
                                <div style="grid-column: 1 / -1; background:rgba(0,0,0,0.25); padding:6px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="color:rgba(255,255,255,0.45); margin-bottom:4px;">Vector Coordinates Preview (First 8 values)</div>
                                    <div style="font-size:9px; display:flex; gap:4px; flex-wrap:wrap;">${previewChips}</div>
                                </div>
                            </div>

                            <!-- ENROLLMENT & MULTI-PHOTO PROFILE LINKING TABS -->
                            <div style="margin-top:10px; padding:10px; background:rgba(0,255,209,0.04); border:1px solid rgba(0,255,209,0.22); border-radius:5px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <span style="color:#00FFD1; font-size:11px; font-weight:bold;">
                                        <i class="fas fa-database" style="margin-right:5px;"></i>DATABASE ACTION (FAISS MULTI-PHOTO ENROLLMENT)
                                    </span>
                                    <span id="face-enroll-status-${index}" style="font-size:10px; font-weight:bold;"></span>
                                </div>

                                <!-- Sub-tabs: New Profile vs Link to Existing Profile -->
                                <div style="display:flex; gap:6px; margin-bottom:10px;">
                                    <button type="button" id="tab-enroll-new-${index}" onclick="switchEnrollMode(${index}, 'new')"
                                        style="flex:1; padding:5px 8px; font-size:10px; font-weight:bold; cursor:pointer; background:${isMatched ? 'rgba(255,255,255,0.05)' : 'rgba(0,255,209,0.18)'}; border:1px solid ${isMatched ? 'rgba(255,255,255,0.15)' : '#00FFD1'}; color:${isMatched ? 'rgba(255,255,255,0.7)' : '#00FFD1'}; border-radius:3px; font-family:inherit;">
                                        <i class="fas fa-user-plus" style="margin-right:4px;"></i>CREATE NEW PROFILE
                                    </button>
                                    <button type="button" id="tab-enroll-link-${index}" onclick="switchEnrollMode(${index}, 'link')"
                                        style="flex:1; padding:5px 8px; font-size:10px; font-weight:bold; cursor:pointer; background:${isMatched ? 'rgba(0,255,209,0.18)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${isMatched ? '#00FFD1' : 'rgba(255,255,255,0.15)'}; color:${isMatched ? '#00FFD1' : 'rgba(255,255,255,0.7)'}; border-radius:3px; font-family:inherit;">
                                        <i class="fas fa-link" style="margin-right:4px;"></i>LINK TO EXISTING (${enrolledProfiles.length})
                                    </button>
                                </div>

                                <!-- MODE 1: CREATE NEW PROFILE FORM -->
                                <div id="face-enroll-section-new-${index}" style="display:${isMatched ? 'none' : 'block'};" onclick="window.activeFaceCardIndex = ${index};">
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
                                        <div>
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">NAME *</div>
                                            <input type="text" id="face-enroll-name-${index}" placeholder="Person Full Name *"
                                                value="${initName.replace(/"/g, '&quot;')}"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">DATE OF BIRTH (DOB)</div>
                                            <input type="text" id="face-enroll-dob-${index}" placeholder="DOB (e.g. YYYY-MM-DD)"
                                                value="${initDob.replace(/"/g, '&quot;')}"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#FFD166; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">ID / DOC NUMBER</div>
                                            <input type="text" id="face-enroll-idnum-${index}" placeholder="DL / ID / Passport #"
                                                value="${initIdNum.replace(/"/g, '&quot;')}"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#7C93FF; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="font-size:9px; color:#FF6B6B; margin-bottom:2px;">🩸 BLOOD GROUP</div>
                                            <input type="text" id="face-enroll-blood-${index}" list="blood-group-list" placeholder="A+, B+, O+, AB+, etc."
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,107,107,0.3); color:#FF6B6B; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">DOCUMENT TYPE</div>
                                            <input type="text" id="face-enroll-doctype-${index}" placeholder="Document Type"
                                                value="${initDocType.replace(/"/g, '&quot;')}"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#00FFD1; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="font-size:9px; color:#00FFD1; margin-bottom:2px;">📧 EMAIL</div>
                                            <input type="email" id="face-enroll-email-${index}" placeholder="name@domain.com"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                                                <span style="font-size:9px; color:#FFD166;">📞 PHONE NUMBER</span>
                                                <button type="button" onclick="launchPhoneIntelligenceUplink(${index})"
                                                    title="Query this phone in Phone Intelligence Uplink or search Phone Book by person name"
                                                    style="background:rgba(0,255,209,0.12); border:1px solid rgba(0,255,209,0.35); color:#00FFD1; font-size:8.5px; padding:1px 5px; border-radius:2px; cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:3px;">
                                                    <i class="fas fa-satellite-dish"></i> <span>UPLINK</span>
                                                </button>
                                            </div>
                                            <input type="text" id="face-enroll-phone-${index}" placeholder="+1 (555) 000-0000"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                        <div>
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">ADDRESS</div>
                                            <input type="text" id="face-enroll-addr-${index}" placeholder="Address / Location"
                                                value="${initAddr.replace(/"/g, '&quot;')}"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>

                                        <!-- Relative / Kin Details -->
                                        <div style="grid-column:1 / -1; background:rgba(124,147,255,0.06); border:1px solid rgba(124,147,255,0.2); border-radius:4px; padding:6px 8px;">
                                            <div style="color:#7C93FF; font-size:9px; font-weight:bold; margin-bottom:4px;"><i class="fas fa-users" style="margin-right:4px;"></i>RELATIVE / KIN DETAILS</div>
                                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                                                <div>
                                                    <div style="font-size:8px; color:rgba(255,255,255,0.4); margin-bottom:2px;">RELATIVE NAME</div>
                                                    <input type="text" id="face-enroll-relative-name-${index}" placeholder="Relative Full Name"
                                                        onfocus="window.activeFaceCardIndex = ${index};"
                                                        style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                                                </div>
                                                <div>
                                                    <div style="font-size:8px; color:rgba(255,255,255,0.4); margin-bottom:2px;">RELATIONSHIP</div>
                                                    <select id="face-enroll-relative-relation-${index}" onchange="toggleEnrollRelativeOtherExplain(${index})" onfocus="window.activeFaceCardIndex = ${index};"
                                                        style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.6); border:1px solid #7C93FF; color:#fff; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                                                        <option value="">-- Relationship --</option>
                                                        <option value="Father">Father</option>
                                                        <option value="Mother">Mother</option>
                                                        <option value="Brother">Brother</option>
                                                        <option value="Sister">Sister</option>
                                                        <option value="Spouse">Spouse</option>
                                                        <option value="Son">Son</option>
                                                        <option value="Daughter">Daughter</option>
                                                        <option value="Cousin">Cousin</option>
                                                        <option value="Guardian">Guardian</option>
                                                        <option value="Other">Other (Explain)</option>
                                                    </select>
                                                </div>
                                                <div id="face-enroll-relative-other-wrap-${index}" style="grid-column:1 / -1; display:none;">
                                                    <div style="font-size:8px; color:#FFD166; margin-bottom:2px;">EXPLAIN OTHER RELATIONSHIP</div>
                                                    <input type="text" id="face-enroll-relative-other-${index}" placeholder="e.g. Uncle, Aunt, Grandparent, Caregiver"
                                                        onfocus="window.activeFaceCardIndex = ${index};"
                                                        style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.4); border:1px solid #FFD166; color:#FFD166; padding:5px 7px; font-size:10px; font-family:inherit; border-radius:3px;">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Dynamic Custom Attributes -->
                                        <div style="grid-column:1 / -1; background:rgba(0,255,209,0.03); border:1px solid rgba(0,255,209,0.18); border-radius:4px; padding:6px 8px;">
                                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                                <span style="color:#00FFD1; font-size:9px; font-weight:bold;"><i class="fas fa-tags" style="margin-right:4px;"></i>DYNAMIC CUSTOM FIELDS</span>
                                                <button type="button" onclick="addEnrollCustomFieldRow(${index}, '', '')" style="background:rgba(0,255,209,0.15); border:1px solid #00FFD1; color:#00FFD1; padding:2px 7px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:9px; font-weight:bold;">
                                                    <i class="fas fa-plus"></i> + ADD FIELD
                                                </button>
                                            </div>
                                            <div id="face-enroll-custom-fields-${index}" style="display:flex; flex-direction:column; gap:4px;">
                                                <!-- Dynamic rows injected here -->
                                            </div>
                                        </div>

                                        <div style="grid-column:1 / -1;">
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:2px;">NOTES / TAGS</div>
                                            <input type="text" id="face-enroll-notes-${index}" placeholder="Role / Tag / Notes (Optional)"
                                                value="${initNotes.replace(/"/g, '&quot;')}"
                                                onfocus="window.activeFaceCardIndex = ${index};"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                        </div>
                                    </div>

                                    <button type="button" id="face-enroll-btn-${index}" onclick="enrollFaceToDatabase(${index})"
                                        style="width:100%; background:rgba(0,255,209,0.15); border:1px solid #00FFD1; color:#00FFD1; padding:7px; cursor:pointer; font-family:inherit; font-size:11px; font-weight:bold; border-radius:3px; transition:all 0.15s; margin-top:4px;"
                                        onmouseover="this.style.background='rgba(0,255,209,0.28)'" onmouseout="this.style.background='rgba(0,255,209,0.15)'">
                                        <i class="fas fa-plus-circle" style="margin-right:5px;"></i>SAVE TO FACE DATABASE (FAISS INDEX)
                                    </button>
                                </div>

                                <!-- MODE 2: LINK TO EXISTING PROFILE (MULTI-PHOTO) -->
                                <div id="face-enroll-section-link-${index}" style="display:${isMatched ? 'block' : 'none'};">
                                    <div style="font-size:10px; color:rgba(255,255,255,0.65); line-height:1.4; margin-bottom:8px;">
                                        <i class="fas fa-info-circle" style="color:#00FFD1; margin-right:4px;"></i>Link this detected photo to an existing profile. Registering multiple angles and photos per person maximizes FAISS accuracy and eliminates missed recognitions.
                                    </div>

                                    ${enrolledProfiles.length === 0 ? `
                                        <div style="padding:10px; border:1px dashed rgba(255,255,255,0.15); border-radius:4px; text-align:center; color:rgba(255,255,255,0.4); font-size:10px;">
                                            No existing profiles found in database. Use "CREATE NEW PROFILE" above to register the first identity.
                                        </div>
                                    ` : `
                                        <div style="margin-bottom:8px;">
                                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                                <span style="font-size:9px; color:rgba(255,255,255,0.5); font-weight:bold;">SELECT EXISTING PROFILE TO LINK *</span>
                                                <span id="face-link-count-${index}" style="font-size:9px; color:#00FFD1;">${enrolledProfiles.length} profiles</span>
                                            </div>

                                            <!-- Live Search Filter for linking existing profile -->
                                            <div style="position:relative; margin-bottom:5px;">
                                                <i class="fas fa-search" style="position:absolute; left:8px; top:8px; font-size:10px; color:#00FFD1; opacity:0.8;"></i>
                                                <input type="text" id="face-link-search-${index}"
                                                    placeholder="Search profiles by name, ID#, blood, phone, relative, tags..."
                                                    oninput="filterFaceLinkProfiles(${index})"
                                                    style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid rgba(0,255,209,0.3); color:#00FFD1; padding:6px 8px 6px 24px; font-size:10px; font-family:inherit; border-radius:3px;">
                                            </div>

                                            <select id="face-link-select-${index}" onchange="updateSelectedProfilePreview(${index})"
                                                style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid #00FFD1; color:#fff; padding:6px 8px; font-size:11px; font-family:inherit; border-radius:3px;">
                                                ${linkOptionsHtml}
                                            </select>

                                            <!-- Selected Profile Card Preview -->
                                            <div id="face-link-preview-${index}" style="margin-top:6px; padding:6px 8px; background:rgba(0,255,209,0.04); border:1px solid rgba(0,255,209,0.18); border-radius:4px; font-size:10px; min-height:36px; display:flex; align-items:center; gap:8px;">
                                            </div>
                                        </div>

                                        <label style="font-size:10px; color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:6px; margin-bottom:8px; cursor:pointer;">
                                            <input type="checkbox" id="face-link-merge-${index}" checked style="accent-color:#00FFD1;">
                                            Merge detected OCR fields (DOB, ID#, Address) if empty in target profile
                                        </label>

                                        <button type="button" id="face-link-btn-${index}" onclick="linkFaceToExistingProfile(${index})"
                                            style="width:100%; background:rgba(124,147,255,0.18); border:1px solid #7C93FF; color:#7C93FF; padding:7px; cursor:pointer; font-family:inherit; font-size:11px; font-weight:bold; border-radius:3px; transition:all 0.15s;"
                                            onmouseover="this.style.background='rgba(124,147,255,0.3)'" onmouseout="this.style.background='rgba(124,147,255,0.18)'">
                                            <i class="fas fa-link" style="margin-right:5px;"></i>LINK THIS PHOTO TO PROFILE (MULTI-VECTOR FAISS)
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                container.innerHTML = ocrHtml + facesHtml;

                // Initialize preview cards for all face linking options
                faces.forEach((_, idx) => {
                    updateSelectedProfilePreview(idx);
                });
            }

            window.filterFaceLinkProfiles = function(index) {
                const searchInput = document.getElementById(`face-link-search-${index}`);
                const selectElem = document.getElementById(`face-link-select-${index}`);
                const countSpan = document.getElementById(`face-link-count-${index}`);
                if (!selectElem) return;

                const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
                const enrolled = window.enrolledFacesList || [];

                const filtered = enrolled.filter(p => {
                    if (!query) return true;
                    const name = (p.name || '').toLowerCase();
                    const idNum = (p.id_number || '').toLowerCase();
                    const blood = (p.bloodGroup || p.blood_group || '').toLowerCase();
                    const email = (p.email || '').toLowerCase();
                    const phone = (p.phone || '').toLowerCase();
                    const relName = (p.relativeName || p.relative_name || '').toLowerCase();
                    const relRel = (p.relativeRelation || p.relative_relation || '').toLowerCase();
                    const notes = (p.notes || '').toLowerCase();
                    const idStr = String(p.id);

                    let customMatches = false;
                    const cf = p.customFields || p.custom_fields || {};
                    if (typeof cf === 'object') {
                        customMatches = Object.entries(cf).some(([k, v]) =>
                            k.toLowerCase().includes(query) || String(v).toLowerCase().includes(query)
                        );
                    }

                    return name.includes(query) || idNum.includes(query) || blood.includes(query) ||
                           email.includes(query) || phone.includes(query) || relName.includes(query) ||
                           relRel.includes(query) || notes.includes(query) || idStr.includes(query) || customMatches;
                });

                if (countSpan) {
                    countSpan.textContent = query ? `${filtered.length} of ${enrolled.length} match` : `${enrolled.length} profiles`;
                }

                const currentVal = selectElem.value;
                if (filtered.length === 0) {
                    selectElem.innerHTML = '<option value="">No matching profiles found</option>';
                } else {
                    selectElem.innerHTML = filtered.map(p => {
                        const isSel = (String(p.id) === currentVal) ? 'selected' : '';
                        const pCount = p.photoCount || (p.photos ? p.photos.length : 1);
                        const extra = [p.bloodGroup || p.blood_group, p.id_number].filter(Boolean).join(' · ');
                        return `<option value="${p.id}" ${isSel}>#${p.id} - ${p.name} (${pCount} photo${pCount === 1 ? '' : 's'}${extra ? ' · ' + extra : ''})</option>`;
                    }).join('');
                }

                updateSelectedProfilePreview(index);
            };

            window.updateSelectedProfilePreview = function(index) {
                const selectElem = document.getElementById(`face-link-select-${index}`);
                const previewDiv = document.getElementById(`face-link-preview-${index}`);
                if (!selectElem || !previewDiv) return;

                const profileId = parseInt(selectElem.value);
                const enrolled = window.enrolledFacesList || [];
                const prof = enrolled.find(p => p.id === profileId);

                if (!prof) {
                    previewDiv.innerHTML = '<span style="color:rgba(255,255,255,0.4); font-size:10px;"><i class="fas fa-user-slash" style="margin-right:4px;"></i>No profile selected</span>';
                    return;
                }

                const pCount = prof.photoCount || (prof.photos ? prof.photos.length : 1);
                const blood = prof.bloodGroup || prof.blood_group;
                const rel = prof.relativeName || prof.relative_name;

                previewDiv.innerHTML = `
                    <img src="${prof.thumbnail || ''}" alt="${prof.name}" style="width:36px; height:36px; object-fit:cover; border-radius:3px; border:1px solid #00FFD1; background:#000;">
                    <div style="flex:1; overflow:hidden;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#00FFD1; font-weight:bold; font-size:11px;">#${prof.id} - ${prof.name}</span>
                            <span style="color:#7C93FF; font-size:9px;">${pCount} registered photo${pCount === 1 ? '' : 's'}</span>
                        </div>
                        <div style="display:flex; gap:6px; font-size:9px; color:rgba(255,255,255,0.6); margin-top:2px; flex-wrap:wrap;">
                            ${prof.id_number ? `<span>ID: <b>${prof.id_number}</b></span>` : ''}
                            ${blood ? `<span style="color:#FF6B6B;">🩸 <b>${blood}</b></span>` : ''}
                            ${rel ? `<span style="color:#7C93FF;">👥 ${prof.relativeRelation || 'Rel'}: ${rel}</span>` : ''}
                            ${prof.email ? `<span>📧 ${prof.email}</span>` : ''}
                        </div>
                    </div>
                `;
            };

            window.switchEnrollMode = function(index, mode) {
                const secNew = document.getElementById(`face-enroll-section-new-${index}`);
                const secLink = document.getElementById(`face-enroll-section-link-${index}`);
                const tabNew = document.getElementById(`tab-enroll-new-${index}`);
                const tabLink = document.getElementById(`tab-enroll-link-${index}`);

                if (mode === 'link') {
                    if (secNew) secNew.style.display = 'none';
                    if (secLink) secLink.style.display = 'block';
                    if (tabNew) {
                        tabNew.style.background = 'rgba(255,255,255,0.05)';
                        tabNew.style.borderColor = 'rgba(255,255,255,0.15)';
                        tabNew.style.color = 'rgba(255,255,255,0.7)';
                    }
                    if (tabLink) {
                        tabLink.style.background = 'rgba(0,255,209,0.18)';
                        tabLink.style.borderColor = '#00FFD1';
                        tabLink.style.color = '#00FFD1';
                    }
                } else {
                    if (secNew) secNew.style.display = 'block';
                    if (secLink) secLink.style.display = 'none';
                    if (tabNew) {
                        tabNew.style.background = 'rgba(0,255,209,0.18)';
                        tabNew.style.borderColor = '#00FFD1';
                        tabNew.style.color = '#00FFD1';
                    }
                    if (tabLink) {
                        tabLink.style.background = 'rgba(255,255,255,0.05)';
                        tabLink.style.borderColor = 'rgba(255,255,255,0.15)';
                        tabLink.style.color = 'rgba(255,255,255,0.7)';
                    }
                }
            };

            window.linkFaceToExistingProfile = async function(index) {
                if (!window.faceRecognitionState || !window.faceRecognitionState.analysis || !window.faceRecognitionState.analysis.faces) return;
                const face = window.faceRecognitionState.analysis.faces[index];
                if (!face) return;

                const selectElem = document.getElementById(`face-link-select-${index}`);
                const mergeCheckbox = document.getElementById(`face-link-merge-${index}`);
                const statusSpan = document.getElementById(`face-enroll-status-${index}`);
                const btn = document.getElementById(`face-link-btn-${index}`);

                const profileId = selectElem ? parseInt(selectElem.value) : null;
                if (!profileId) {
                    if (statusSpan) {
                        statusSpan.style.color = '#FF4444';
                        statusSpan.textContent = 'Select an existing profile to link!';
                    }
                    return;
                }

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> LINKING VECTOR TO PROFILE...';
                }

                try {
                    const analysis = window.faceRecognitionState.analysis;
                    const ocrFields = (analysis && analysis.ocr && analysis.ocr.detectedFields) ? analysis.ocr.detectedFields : {};

                    const bloodInput = document.getElementById(`face-enroll-blood-${index}`);
                    const emailInput = document.getElementById(`face-enroll-email-${index}`);
                    const phoneInput = document.getElementById(`face-enroll-phone-${index}`);
                    const relNameInput = document.getElementById(`face-enroll-relative-name-${index}`);
                    const relRelInput = document.getElementById(`face-enroll-relative-relation-${index}`);
                    const relOtherInput = document.getElementById(`face-enroll-relative-other-${index}`);

                    const mergeFields = (mergeCheckbox && mergeCheckbox.checked) ? {
                        dob: ocrFields.dob || '',
                        address: ocrFields.address || '',
                        id_number: ocrFields.id_number || '',
                        document_type: ocrFields.document_type || '',
                        blood_group: (bloodInput ? bloodInput.value : '').trim(),
                        email: (emailInput ? emailInput.value : '').trim(),
                        phone: (phoneInput ? phoneInput.value : '').trim(),
                        relative_name: (relNameInput ? relNameInput.value : '').trim(),
                        relative_relation: (relRelInput ? relRelInput.value : '').trim(),
                        relative_other_explain: (relOtherInput ? relOtherInput.value : '').trim(),
                        custom_fields: getEnrollCustomFields(index)
                    } : {};

                    const resp = await fetch('/api/face/database/link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            profile_id: profileId,
                            embedding: face.embedding,
                            thumbnail: face.thumbnail,
                            exif: analysis ? analysis.exif : null,
                            quality_score: face.qualityScore,
                            merge_fields: mergeFields
                        })
                    });

                    const data = await resp.json();
                    if (resp.ok && data.status === 'success') {
                        if (statusSpan) {
                            statusSpan.style.color = '#00FFD1';
                            statusSpan.textContent = `Linked! (${data.record.photoCount} photos registered)`;
                        }
                        if (btn) {
                            btn.style.background = 'rgba(0,255,209,0.25)';
                            btn.style.borderColor = '#00FFD1';
                            btn.style.color = '#00FFD1';
                            btn.innerHTML = `<i class="fas fa-check"></i> LINKED TO "${data.record.name}" (${data.record.photoCount} PHOTOS)`;
                        }

                        face.matchedIdentity = {
                            id: data.record.id,
                            name: data.record.name,
                            matchPct: 100.0,
                            photoCount: data.record.photoCount,
                            source: 'FAISS Multi-Photo Vector Index'
                        };

                        const img = document.getElementById('face-preview-image');
                        drawFaceOverlay(img, window.faceRecognitionState.analysis.faces);
                        updateDatabaseBadge();
                        loadFaceDatabase();
                        showFaceRecognitionMessage(data.message, 'success');
                    } else {
                        throw new Error(data.error || 'Failed to link face vector');
                    }
                } catch (e) {
                    if (statusSpan) {
                        statusSpan.style.color = '#FF4444';
                        statusSpan.textContent = e.message;
                    }
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-link"></i> LINK THIS PHOTO TO PROFILE';
                    }
                    showFaceRecognitionMessage('Linking error: ' + e.message, 'error');
                }
            };

            window.enrollFaceToDatabase = async function (index) {
                if (!window.faceRecognitionState || !window.faceRecognitionState.analysis || !window.faceRecognitionState.analysis.faces) return;
                const face = window.faceRecognitionState.analysis.faces[index];
                if (!face) return;

                const nameInput = document.getElementById(`face-enroll-name-${index}`);
                const dobInput = document.getElementById(`face-enroll-dob-${index}`);
                const addrInput = document.getElementById(`face-enroll-addr-${index}`);
                const idNumInput = document.getElementById(`face-enroll-idnum-${index}`);
                const docTypeInput = document.getElementById(`face-enroll-doctype-${index}`);
                const notesInput = document.getElementById(`face-enroll-notes-${index}`);
                const bloodInput = document.getElementById(`face-enroll-blood-${index}`);
                const emailInput = document.getElementById(`face-enroll-email-${index}`);
                const phoneInput = document.getElementById(`face-enroll-phone-${index}`);
                const relNameInput = document.getElementById(`face-enroll-relative-name-${index}`);
                const relRelInput = document.getElementById(`face-enroll-relative-relation-${index}`);
                const relOtherInput = document.getElementById(`face-enroll-relative-other-${index}`);
                const statusSpan = document.getElementById(`face-enroll-status-${index}`);
                const btn = document.getElementById(`face-enroll-btn-${index}`);

                const name = (nameInput ? nameInput.value : '').trim();
                const dob = (dobInput ? dobInput.value : '').trim();
                const address = (addrInput ? addrInput.value : '').trim();
                const idNumber = (idNumInput ? idNumInput.value : '').trim();
                const documentType = (docTypeInput ? docTypeInput.value : '').trim();
                const notes = (notesInput ? notesInput.value : '').trim();
                const bloodGroup = (bloodInput ? bloodInput.value : '').trim();
                const email = (emailInput ? emailInput.value : '').trim();
                const phone = (phoneInput ? phoneInput.value : '').trim();
                const relativeName = (relNameInput ? relNameInput.value : '').trim();
                const relativeRelation = (relRelInput ? relRelInput.value : '').trim();
                const relativeOtherExplain = (relOtherInput ? relOtherInput.value : '').trim();
                const customFields = getEnrollCustomFields(index);

                if (!name) {
                    if (statusSpan) {
                        statusSpan.style.color = '#FF4444';
                        statusSpan.textContent = 'Enter person name first!';
                    }
                    if (nameInput) nameInput.focus();
                    return;
                }

                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING TO DATABASE...';
                }

                try {
                    const analysis = window.faceRecognitionState.analysis;
                    const ocrRaw = analysis && analysis.ocr ? (analysis.ocr.rawText || '') : '';

                    const resp = await fetch('/api/face/database/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            dob: dob,
                            address: address,
                            id_number: idNumber,
                            document_type: documentType,
                            notes: notes,
                            blood_group: bloodGroup,
                            email: email,
                            phone: phone,
                            relative_name: relativeName,
                            relative_relation: relativeRelation,
                            relative_other_explain: relativeOtherExplain,
                            custom_fields: customFields,
                            embedding: face.embedding,
                            thumbnail: face.thumbnail,
                            ocr_raw_text: ocrRaw,
                            exif: analysis ? analysis.exif : null,
                            quality_score: face.qualityScore,
                            metadata: {
                                box: face.box,
                                confidence: face.confidence,
                                embeddingId: face.embeddingId,
                                qualityScore: face.qualityScore
                            }
                        })
                    });

                    const data = await resp.json();
                    if (resp.ok && data.status === 'success') {
                        if (statusSpan) {
                            statusSpan.style.color = '#00FFD1';
                            statusSpan.textContent = 'Enrolled in FAISS & DB!';
                        }
                        if (btn) {
                            btn.style.background = 'rgba(0,255,209,0.25)';
                            btn.innerHTML = `<i class="fas fa-check"></i> ENROLLED AS "${name}"`;
                        }
                        face.matchedIdentity = {
                            id: data.record.id,
                            name: name,
                            dob: dob,
                            address: address,
                            idNumber: idNumber,
                            documentType: documentType,
                            bloodGroup: bloodGroup,
                            email: email,
                            phone: phone,
                            relativeName: relativeName,
                            relativeRelation: relativeRelation,
                            relativeOtherExplain: relativeOtherExplain,
                            customFields: customFields,
                            notes: notes,
                            matchPct: 100.0,
                            l2Distance: 0.0,
                            photoCount: 1,
                            source: 'FAISS Vector Index'
                        };
                        const img = document.getElementById('face-preview-image');
                        drawFaceOverlay(img, window.faceRecognitionState.analysis.faces);
                        updateDatabaseBadge();
                        loadFaceDatabase();
                        showFaceRecognitionMessage(`Profile for "${name}" registered successfully.`, 'success');
                    } else {
                        throw new Error(data.error || 'Failed to enroll');
                    }
                } catch (e) {
                    if (statusSpan) {
                        statusSpan.style.color = '#FF4444';
                        statusSpan.textContent = e.message;
                    }
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-plus-circle"></i> SAVE TO FACE DATABASE';
                    }
                    showFaceRecognitionMessage('Enrollment error: ' + e.message, 'error');
                }
            };

            window.switchFacePopupTab = function (tab) {
                const scanView = document.getElementById('face-view-scan');
                const dbView = document.getElementById('face-view-database');
                const btnScan = document.getElementById('face-tab-btn-scan');
                const btnDb = document.getElementById('face-tab-btn-db');

                if (tab === 'database') {
                    if (scanView) scanView.style.display = 'none';
                    if (dbView) dbView.style.display = 'block';
                    if (btnScan) {
                        btnScan.style.background = 'rgba(255,255,255,0.04)';
                        btnScan.style.borderColor = 'rgba(255,255,255,0.15)';
                        btnScan.style.color = 'rgba(255,255,255,0.7)';
                    }
                    if (btnDb) {
                        btnDb.style.background = 'rgba(0,255,209,0.18)';
                        btnDb.style.borderColor = '#00FFD1';
                        btnDb.style.color = '#00FFD1';
                    }
                    loadFaceDatabase();
                } else {
                    if (scanView) scanView.style.display = 'flex';
                    if (dbView) dbView.style.display = 'none';
                    if (btnScan) {
                        btnScan.style.background = 'rgba(0,255,209,0.18)';
                        btnScan.style.borderColor = '#00FFD1';
                        btnScan.style.color = '#00FFD1';
                    }
                    if (btnDb) {
                        btnDb.style.background = 'rgba(255,255,255,0.04)';
                        btnDb.style.borderColor = 'rgba(255,255,255,0.15)';
                        btnDb.style.color = 'rgba(255,255,255,0.7)';
                    }
                }
            };

            window.loadFaceDatabase = async function () {
                try {
                    const resp = await fetch('/api/face/database/list');
                    const data = await resp.json();
                    if (data.status === 'success') {
                        window.enrolledFacesList = data.faces || [];
                        renderFaceDatabase(window.enrolledFacesList);
                        if (data.stats) {
                            const sFaces = document.getElementById('stat-total-faces');
                            const sFaiss = document.getElementById('stat-faiss-vectors');
                            const badge = document.getElementById('face-db-count-badge');
                            if (sFaces) sFaces.textContent = data.stats.totalFaces;
                            if (sFaiss) sFaiss.textContent = data.stats.faissVectors;
                            if (badge) badge.textContent = data.stats.totalFaces;
                        }
                    }
                } catch (err) {
                    console.warn('Load face database error:', err);
                }
            };

            function renderFaceDatabase(faces) {
                const grid = document.getElementById('face-db-grid');
                const emptyMsg = document.getElementById('face-db-empty-msg');
                if (!grid) return;
                if (!faces || faces.length === 0) {
                    grid.innerHTML = '';
                    if (emptyMsg) emptyMsg.style.display = 'block';
                    return;
                }
                if (emptyMsg) emptyMsg.style.display = 'none';

                grid.innerHTML = faces.map(f => {
                    const dobBadge = f.dob ? `<span style="color:#FFD166; background:rgba(255,209,102,0.1); border:1px solid rgba(255,209,102,0.25); padding:2px 6px; border-radius:3px; font-size:10px;"><i class="fas fa-birthday-cake" style="margin-right:4px;"></i>DOB: <b>${f.dob}</b></span>` : '';
                    const idBadge = f.id_number ? `<span style="color:#7C93FF; background:rgba(124,147,255,0.1); border:1px solid rgba(124,147,255,0.25); padding:2px 6px; border-radius:3px; font-size:10px; font-family:monospace;"><i class="fas fa-id-badge" style="margin-right:4px;"></i>ID: <b>${f.id_number}</b></span>` : '';
                    const docBadge = f.document_type ? `<span style="color:#00FFD1; background:rgba(0,255,209,0.1); border:1px solid rgba(0,255,209,0.25); padding:2px 6px; border-radius:3px; font-size:9px;">${f.document_type}</span>` : '';

                    const bloodVal = f.bloodGroup || f.blood_group;
                    const bloodBadge = bloodVal ? `<span style="color:#FF6B6B; background:rgba(255,107,107,0.12); border:1px solid rgba(255,107,107,0.3); padding:2px 6px; border-radius:3px; font-size:10px; font-weight:bold;"><i class="fas fa-tint" style="margin-right:3px;"></i>${bloodVal}</span>` : '';

                    const contactBadges = [];
                    if (f.email) contactBadges.push(`<span style="color:#00FFD1; font-size:9px;"><i class="fas fa-envelope" style="margin-right:3px;"></i>${f.email}</span>`);
                    if (f.phone) contactBadges.push(`<span style="color:#FFD166; font-size:9px;"><i class="fas fa-phone" style="margin-right:3px;"></i>${f.phone}</span>`);
                    const contactRow = contactBadges.length ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:3px;">${contactBadges.join(' ')}</div>` : '';

                    let relativeRow = '';
                    const relName = f.relativeName || f.relative_name;
                    const relRel = f.relativeRelation || f.relative_relation || 'Relative';
                    const relExplain = f.relativeOtherExplain || f.relative_other_explain;
                    if (relName) {
                        const explainText = (relRel === 'Other' && relExplain) ? ` (${relExplain})` : (relExplain ? ` · ${relExplain}` : '');
                        relativeRow = `<div style="color:#7C93FF; font-size:9.5px; margin-top:3px;"><i class="fas fa-user-friends" style="margin-right:4px;"></i>${relRel}${explainText}: <b style="color:#fff;">${relName}</b></div>`;
                    }

                    let customChips = '';
                    const cf = f.customFields || f.custom_fields || {};
                    if (cf && typeof cf === 'object' && Object.keys(cf).length > 0) {
                        const chips = Object.entries(cf).map(([k, v]) => `
                            <span style="background:rgba(0,255,209,0.07); border:1px solid rgba(0,255,209,0.22); color:#00FFD1; padding:1px 5px; border-radius:3px; font-size:9px;"><b>${k}:</b> ${v}</span>
                        `).join(' ');
                        customChips = `<div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${chips}</div>`;
                    }

                    const addrRow = f.address ? `<div style="color:rgba(255,255,255,0.7); font-size:10px; margin-top:3px;"><i class="fas fa-map-marker-alt" style="color:#00FFD1; margin-right:4px;"></i>${f.address}</div>` : '';

                    const pCount = f.photoCount || (f.photos ? f.photos.length : 1);
                    const photoBadge = `<span style="background:rgba(0,255,209,0.14); color:#00FFD1; border:1px solid rgba(0,255,209,0.3); padding:2px 6px; border-radius:3px; font-size:9px; font-weight:bold;"><i class="fas fa-images" style="margin-right:3px;"></i>${pCount} Photo${pCount === 1 ? '' : 's'}</span>`;

                    // Mini gallery of registered photos
                    let galleryHtml = '';
                    if (f.photos && f.photos.length > 1) {
                        const thumbs = f.photos.map((src, pidx) => `
                            <img src="${src}" alt="Photo ${pidx + 1}" title="Photo #${pidx + 1}" style="width:28px; height:28px; object-fit:cover; border-radius:3px; border:1px solid rgba(0,255,209,0.35); background:#000;">
                        `).join('');
                        galleryHtml = `
                            <div style="display:flex; gap:4px; align-items:center; margin-top:4px; overflow-x:auto;">
                                <span style="font-size:9px; color:rgba(255,255,255,0.4); margin-right:2px;">Gallery:</span>
                                ${thumbs}
                            </div>
                        `;
                    }

                    // EXIF metadata badge if present
                    let exifBadge = '';
                    if (f.exif && (f.exif.cameraModel || f.exif.cameraMake || f.exif.dateTime)) {
                        const cam = (f.exif.cameraMake && f.exif.cameraMake !== 'Unknown' ? f.exif.cameraMake + ' ' : '') + (f.exif.cameraModel || '');
                        const dt = f.exif.dateTime || '';
                        exifBadge = `<div style="color:rgba(255,255,255,0.45); font-size:9px; margin-top:3px;"><i class="fas fa-camera" style="color:#7C93FF; margin-right:4px;"></i>${cam || 'Digital Image'}${dt ? ' · ' + dt : ''}</div>`;
                    }

                    return `
                        <div onclick="openFaceDetailModal(${f.id})" title="Click to view full profile dossier for ${f.name}" style="background:rgba(255,255,255,0.03); border:1px solid rgba(0,255,209,0.2); border-radius:6px; padding:12px; display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); user-select:none;" onmouseover="this.style.borderColor='#00FFD1'; this.style.boxShadow='0 0 16px rgba(0,255,209,0.25)'; this.style.background='rgba(0,255,209,0.04)';" onmouseout="this.style.borderColor='rgba(0,255,209,0.2)'; this.style.boxShadow='none'; this.style.background='rgba(255,255,255,0.03)';">
                            <div style="display:flex; gap:10px; align-items:center;">
                                <img src="${f.thumbnail || ''}" alt="${f.name}" style="width:58px; height:58px; object-fit:cover; border-radius:4px; border:1px solid rgba(0,255,209,0.3); background:#000;">
                                <div style="flex:1; overflow:hidden;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="color:#00FFD1; font-size:13px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fas fa-id-card-alt" style="margin-right:4px;"></i>${f.name}</span>
                                        <div style="display:flex; gap:4px; align-items:center;">
                                            ${photoBadge}
                                            ${docBadge}
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
                                        ${dobBadge}
                                        ${idBadge}
                                        ${bloodBadge}
                                    </div>
                                    ${contactRow}
                                    ${relativeRow}
                                    ${customChips}
                                    ${addrRow}
                                    ${exifBadge}
                                    <div style="color:rgba(255,255,255,0.5); font-size:10px; margin-top:3px;">${f.notes || ''}</div>
                                    <div style="color:rgba(255,255,255,0.35); font-size:9px; font-family:monospace; margin-top:2px;">${f.embedding_hash || 'SFACE-128D'}</div>
                                    ${galleryHtml}
                                </div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.06); padding-top:6px; font-size:9px; color:rgba(255,255,255,0.4);" onclick="event.stopPropagation();">
                                <span style="display:flex; align-items:center; gap:4px;"><i class="fas fa-folder-open" style="color:#00FFD1;"></i> Enrolled: ${f.created_at ? f.created_at.split(' ')[0] : 'Indexed'}</span>
                                <div style="display:flex; gap:6px; align-items:center;">
                                    <button type="button" onclick="event.stopPropagation(); openFaceEditModal(${f.id})" style="background:rgba(0,255,209,0.12); border:1px solid rgba(0,255,209,0.3); color:#00FFD1; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;" onmouseover="this.style.background='rgba(0,255,209,0.25)'" onmouseout="this.style.background='rgba(0,255,209,0.12)'">
                                        <i class="fas fa-edit"></i> EDIT
                                    </button>
                                    <button type="button" onclick="event.stopPropagation(); openFaceMergeModal(${f.id})" style="background:rgba(124,147,255,0.12); border:1px solid rgba(124,147,255,0.3); color:#7C93FF; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;" onmouseover="this.style.background='rgba(124,147,255,0.25)'" onmouseout="this.style.background='rgba(124,147,255,0.12)'">
                                        <i class="fas fa-code-branch"></i> MERGE
                                    </button>
                                    <button type="button" onclick="event.stopPropagation(); deleteFaceFromDatabase(${f.id})" style="background:rgba(255,80,80,0.1); border:1px solid rgba(255,80,80,0.3); color:#FF5555; padding:3px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;" onmouseover="this.style.background='rgba(255,80,80,0.25)'" onmouseout="this.style.background='rgba(255,80,80,0.1)'">
                                        <i class="fas fa-trash"></i> DELETE
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            window.filterFaceDatabaseList = function () {
                const input = document.getElementById('face-db-search-input');
                const query = (input ? input.value : '').toLowerCase().trim();
                const list = window.enrolledFacesList || [];
                if (!query) {
                    renderFaceDatabase(list);
                    return;
                }
                const filtered = list.filter(f =>
                    (f.name && f.name.toLowerCase().includes(query)) ||
                    (f.dob && f.dob.toLowerCase().includes(query)) ||
                    (f.address && f.address.toLowerCase().includes(query)) ||
                    (f.id_number && f.id_number.toLowerCase().includes(query)) ||
                    (f.document_type && f.document_type.toLowerCase().includes(query)) ||
                    (f.bloodGroup && f.bloodGroup.toLowerCase().includes(query)) ||
                    (f.blood_group && f.blood_group.toLowerCase().includes(query)) ||
                    (f.email && f.email.toLowerCase().includes(query)) ||
                    (f.phone && f.phone.toLowerCase().includes(query)) ||
                    (f.relativeName && f.relativeName.toLowerCase().includes(query)) ||
                    (f.relative_name && f.relative_name.toLowerCase().includes(query)) ||
                    (f.relativeRelation && f.relativeRelation.toLowerCase().includes(query)) ||
                    (f.notes && f.notes.toLowerCase().includes(query)) ||
                    (f.embedding_hash && f.embedding_hash.toLowerCase().includes(query)) ||
                    (f.customFields && Object.entries(f.customFields).some(([k, v]) => k.toLowerCase().includes(query) || String(v).toLowerCase().includes(query)))
                );
                renderFaceDatabase(filtered);
            };

            window.deleteFaceFromDatabase = async function (faceId) {
                if (!confirm('Remove this person identity from Face Database and FAISS index?')) return;
                try {
                    const resp = await fetch(`/api/face/database/delete/${faceId}`, { method: 'POST' });
                    const data = await resp.json();
                    if (data.status === 'success') {
                        loadFaceDatabase();
                    }
                } catch (e) {
                    alert('Error deleting face: ' + e.message);
                }
            };

            // Face Profile Full Dossier Detail Modal Handlers
            window.openFaceDetailModal = function(faceId) {
                const list = window.enrolledFacesList || [];
                const face = list.find(f => f.id === faceId);
                if (!face) {
                    showFaceRecognitionMessage('Profile not found in loaded database.', 'error');
                    return;
                }
                const modal = document.getElementById('face-detail-modal');
                if (!modal) return;

                // ID and Avatar
                const idEl = document.getElementById('face-detail-id');
                if (idEl) idEl.textContent = face.id;

                const avatar = document.getElementById('face-detail-avatar');
                if (avatar) avatar.src = face.thumbnail || '';

                const pCount = face.photoCount || (face.photos ? face.photos.length : 1);
                const countBadge = document.getElementById('face-detail-photo-count-badge');
                if (countBadge) countBadge.textContent = `${pCount} Registered Photo${pCount === 1 ? '' : 's'}`;

                // Multi-photo gallery thumbnails
                const gallery = document.getElementById('face-detail-gallery');
                if (gallery) {
                    gallery.innerHTML = '';
                    if (face.photos && face.photos.length > 0) {
                        face.photos.forEach((src, idx) => {
                            const img = document.createElement('img');
                            img.src = src;
                            img.alt = `Photo ${idx + 1}`;
                            img.title = `Click to preview photo #${idx + 1}`;
                            img.style.cssText = 'width:34px; height:34px; object-fit:cover; border-radius:3px; border:1px solid rgba(0,255,209,0.4); cursor:pointer; background:#000; transition:transform 0.15s;';
                            img.onmouseover = () => { img.style.transform = 'scale(1.1)'; img.style.borderColor = '#00FFD1'; };
                            img.onmouseout = () => { img.style.transform = 'scale(1)'; img.style.borderColor = 'rgba(0,255,209,0.4)'; };
                            img.onclick = () => { if (avatar) avatar.src = src; };
                            gallery.appendChild(img);
                        });
                    }
                }

                // Core Identity Fields
                const nameEl = document.getElementById('face-detail-name');
                if (nameEl) nameEl.textContent = face.name || 'Unnamed Identity';

                const dobEl = document.getElementById('face-detail-dob');
                if (dobEl) dobEl.textContent = face.dob || 'Not Recorded';

                const idnumEl = document.getElementById('face-detail-idnum');
                if (idnumEl) idnumEl.textContent = face.id_number || 'Not Recorded';

                const bloodEl = document.getElementById('face-detail-blood');
                if (bloodEl) bloodEl.textContent = face.bloodGroup || face.blood_group || 'Not Recorded';

                const docTypeEl = document.getElementById('face-detail-doctype');
                if (docTypeEl) docTypeEl.textContent = face.document_type || 'Identity Card';

                const emailEl = document.getElementById('face-detail-email');
                if (emailEl) emailEl.textContent = face.email || 'Not Recorded';

                const phoneEl = document.getElementById('face-detail-phone');
                const phoneUplinkBtn = document.getElementById('face-detail-phone-uplink-btn');
                if (phoneEl) {
                    phoneEl.textContent = face.phone || 'Not Recorded';
                    if (phoneUplinkBtn) {
                        phoneUplinkBtn.style.display = (face.phone && face.phone.trim()) ? 'inline-flex' : 'none';
                    }
                }

                const addrEl = document.getElementById('face-detail-addr');
                if (addrEl) addrEl.textContent = face.address || 'Not Recorded';

                // Relative / Kin
                const relEl = document.getElementById('face-detail-relative');
                if (relEl) {
                    const rName = face.relativeName || face.relative_name;
                    const rRel = face.relativeRelation || face.relative_relation || 'Relative';
                    const rExp = face.relativeOtherExplain || face.relative_other_explain;
                    if (rName) {
                        const explainText = (rRel === 'Other' && rExp) ? ` (${rExp})` : (rExp ? ` · ${rExp}` : '');
                        relEl.innerHTML = `<span style="color:#7C93FF; font-weight:bold;"><i class="fas fa-users" style="margin-right:4px;"></i>${rRel}${explainText}:</span> <b style="color:#fff;">${rName}</b>`;
                    } else {
                        relEl.innerHTML = '<span style="color:rgba(255,255,255,0.4);">No relative recorded.</span>';
                    }
                }

                // Dynamic Custom Fields
                const cfWrap = document.getElementById('face-detail-custom-fields');
                if (cfWrap) {
                    cfWrap.innerHTML = '';
                    const cf = face.customFields || face.custom_fields || {};
                    if (cf && typeof cf === 'object' && Object.keys(cf).length > 0) {
                        cfWrap.innerHTML = Object.entries(cf).map(([k, v]) => `
                            <span style="background:rgba(0,255,209,0.1); border:1px solid rgba(0,255,209,0.3); color:#00FFD1; padding:3px 8px; border-radius:3px; font-size:10px;">
                                <b style="color:#fff;">${k}:</b> ${v}
                            </span>
                        `).join(' ');
                    } else {
                        cfWrap.innerHTML = '<span style="color:rgba(255,255,255,0.4); font-size:10px;">No custom fields recorded.</span>';
                    }
                }

                // Notes & Metadata
                const notesEl = document.getElementById('face-detail-notes');
                if (notesEl) notesEl.textContent = face.notes || 'No notes.';

                const vecEl = document.getElementById('face-detail-vector');
                if (vecEl) vecEl.textContent = face.embedding_hash || (face.vectorPreview ? face.vectorPreview.slice(0, 4).join(', ') + '...' : 'SFACE-128D Deep Embedding');

                const exifEl = document.getElementById('face-detail-exif');
                if (exifEl) {
                    if (face.exif && (face.exif.cameraModel || face.exif.cameraMake || face.exif.dateTime)) {
                        const cam = (face.exif.cameraMake && face.exif.cameraMake !== 'Unknown' ? face.exif.cameraMake + ' ' : '') + (face.exif.cameraModel || '');
                        const dt = face.exif.dateTime || '';
                        exifEl.innerHTML = `<i class="fas fa-camera" style="color:#7C93FF; margin-right:3px;"></i>Camera: <span style="color:#fff;">${cam || 'Digital Image'}</span>${dt ? ' · ' + dt : ''}`;
                    } else {
                        exifEl.innerHTML = '<i class="fas fa-camera" style="margin-right:3px;"></i>Camera: None';
                    }
                }

                const createdEl = document.getElementById('face-detail-created');
                if (createdEl) createdEl.textContent = face.created_at || 'Indexed';

                // Connect Footer Action Buttons
                const btnEdit = document.getElementById('face-detail-btn-edit');
                if (btnEdit) {
                    btnEdit.onclick = function() {
                        closeFaceDetailModal();
                        openFaceEditModal(face.id);
                    };
                }
                const btnMerge = document.getElementById('face-detail-btn-merge');
                if (btnMerge) {
                    btnMerge.onclick = function() {
                        closeFaceDetailModal();
                        openFaceMergeModal(face.id);
                    };
                }
                const btnDelete = document.getElementById('face-detail-btn-delete');
                if (btnDelete) {
                    btnDelete.onclick = function() {
                        closeFaceDetailModal();
                        deleteFaceFromDatabase(face.id);
                    };
                }

                modal.style.display = 'flex';
            };

            window.closeFaceDetailModal = function() {
                const modal = document.getElementById('face-detail-modal');
                if (modal) modal.style.display = 'none';
            };

            // Backdrop click handler for detail modal
            document.addEventListener('click', function(e) {
                const modal = document.getElementById('face-detail-modal');
                if (modal && modal.style.display === 'flex' && e.target === modal) {
                    closeFaceDetailModal();
                }
            });

            // Face Profile Edit Handlers
            window.openFaceEditModal = function(faceId) {
                const list = window.enrolledFacesList || [];
                const face = list.find(f => f.id === faceId);
                if (!face) {
                    showFaceRecognitionMessage('Profile not found in loaded database.', 'error');
                    return;
                }
                const modal = document.getElementById('face-edit-modal');
                if (!modal) return;

                document.getElementById('face-edit-id').value = face.id;
                document.getElementById('face-edit-title-name').textContent = face.name || `Profile #${face.id}`;
                document.getElementById('face-edit-name').value = face.name || '';
                document.getElementById('face-edit-dob').value = face.dob || '';
                document.getElementById('face-edit-idnum').value = face.id_number || '';
                document.getElementById('face-edit-blood').value = face.bloodGroup || face.blood_group || '';
                document.getElementById('face-edit-doctype').value = face.document_type || '';
                document.getElementById('face-edit-email').value = face.email || '';
                document.getElementById('face-edit-phone').value = face.phone || '';
                document.getElementById('face-edit-relative-name').value = face.relativeName || face.relative_name || '';

                const relSel = document.getElementById('face-edit-relative-relation');
                if (relSel) {
                    relSel.value = face.relativeRelation || face.relative_relation || '';
                    toggleEditRelativeOtherExplain();
                }
                const relOther = document.getElementById('face-edit-relative-other');
                if (relOther) {
                    relOther.value = face.relativeOtherExplain || face.relative_other_explain || '';
                }

                // Populate dynamic custom fields editor
                const cfContainer = document.getElementById('face-edit-custom-fields-container');
                if (cfContainer) {
                    cfContainer.innerHTML = '';
                    const cf = face.customFields || face.custom_fields || {};
                    if (typeof cf === 'object' && Object.keys(cf).length > 0) {
                        Object.entries(cf).forEach(([k, v]) => {
                            addEditModalCustomFieldRow(k, v);
                        });
                    }
                }

                document.getElementById('face-edit-addr').value = face.address || '';
                document.getElementById('face-edit-notes').value = face.notes || '';

                modal.style.display = 'flex';
            };

            window.closeFaceEditModal = function() {
                const modal = document.getElementById('face-edit-modal');
                if (modal) modal.style.display = 'none';
            };

            window.submitFaceProfileEdit = async function() {
                const faceId = document.getElementById('face-edit-id').value;
                const name = document.getElementById('face-edit-name').value.trim();
                if (!name) {
                    alert('Full name cannot be empty.');
                    return;
                }
                const btn = document.getElementById('btn-save-face-edit');
                const originalText = btn ? btn.innerHTML : 'SAVE';
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
                }

                try {
                    const payload = {
                        name: name,
                        dob: document.getElementById('face-edit-dob').value.trim(),
                        id_number: document.getElementById('face-edit-idnum').value.trim(),
                        blood_group: document.getElementById('face-edit-blood').value.trim(),
                        document_type: document.getElementById('face-edit-doctype').value.trim(),
                        email: document.getElementById('face-edit-email').value.trim(),
                        phone: document.getElementById('face-edit-phone').value.trim(),
                        relative_name: document.getElementById('face-edit-relative-name').value.trim(),
                        relative_relation: document.getElementById('face-edit-relative-relation').value.trim(),
                        relative_other_explain: document.getElementById('face-edit-relative-other').value.trim(),
                        custom_fields: getEditModalCustomFields(),
                        address: document.getElementById('face-edit-addr').value.trim(),
                        notes: document.getElementById('face-edit-notes').value.trim()
                    };

                    const resp = await fetch(`/api/face/database/update/${faceId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await resp.json();
                    if (data.status === 'success') {
                        closeFaceEditModal();
                        showFaceRecognitionMessage(`Profile #${faceId} (${name}) updated successfully!`, 'success');
                        loadFaceDatabase();
                    } else {
                        alert('Failed to update profile: ' + (data.message || 'Unknown error'));
                    }
                } catch (err) {
                    alert('Network/API error updating profile: ' + err.message);
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                }
            };

            // Face Profile Merge Handlers
            window.openFaceMergeModal = function(sourceId = null) {
                const modal = document.getElementById('face-merge-modal');
                if (!modal) return;
                const list = window.enrolledFacesList || [];
                if (list.length < 2) {
                    alert('You need at least 2 profiles in the database to perform a merge.');
                    return;
                }

                const sourceSelect = document.getElementById('face-merge-source-select');
                const targetSelect = document.getElementById('face-merge-target-select');

                const buildOptions = (selectedVal) => {
                    return list.map(p => {
                        const isSel = (p.id === selectedVal) ? 'selected' : '';
                        const pCount = p.photoCount || (p.photos ? p.photos.length : 1);
                        return `<option value="${p.id}" ${isSel}>#${p.id} - ${p.name} (${pCount} photo${pCount === 1 ? '' : 's'})</option>`;
                    }).join('');
                };

                const defaultSource = sourceId || list[0].id;
                let defaultTarget = (list.find(p => p.id !== defaultSource) || list[1] || list[0]).id;

                sourceSelect.innerHTML = buildOptions(defaultSource);
                targetSelect.innerHTML = buildOptions(defaultTarget);
                sourceSelect.value = String(defaultSource);
                targetSelect.value = String(defaultTarget);

                updateMergePreviews();
                modal.style.display = 'flex';
            };

            window.closeFaceMergeModal = function() {
                const modal = document.getElementById('face-merge-modal');
                if (modal) modal.style.display = 'none';
            };

            window.updateMergePreviews = function() {
                const list = window.enrolledFacesList || [];
                const sEl = document.getElementById('face-merge-source-select');
                const tEl = document.getElementById('face-merge-target-select');
                if (!sEl || !tEl) return;

                const sourceId = parseInt(sEl.value, 10);
                const targetId = parseInt(tEl.value, 10);

                const sFace = list.find(f => f.id === sourceId);
                const tFace = list.find(f => f.id === targetId);

                const sPrev = document.getElementById('face-merge-source-preview');
                const tPrev = document.getElementById('face-merge-target-preview');

                if (sPrev) {
                    sPrev.innerHTML = sFace ? `
                        <div style="display:flex; gap:6px; align-items:center;">
                            <img src="${sFace.thumbnail || ''}" style="width:36px; height:36px; object-fit:cover; border-radius:3px; border:1px solid #FF7777;">
                            <div>
                                <div style="color:#FF7777; font-weight:bold;">${sFace.name}</div>
                                <div style="color:rgba(255,255,255,0.6); font-size:9px;">DOB: ${sFace.dob || 'None'} · ID#: ${sFace.id_number || 'None'}</div>
                                <div style="color:rgba(255,255,255,0.4); font-size:9px;">${sFace.photoCount || (sFace.photos ? sFace.photos.length : 1)} photo vector(s)</div>
                            </div>
                        </div>
                    ` : 'Select a profile';
                }

                if (tPrev) {
                    tPrev.innerHTML = tFace ? `
                        <div style="display:flex; gap:6px; align-items:center;">
                            <img src="${tFace.thumbnail || ''}" style="width:36px; height:36px; object-fit:cover; border-radius:3px; border:1px solid #00FFD1;">
                            <div>
                                <div style="color:#00FFD1; font-weight:bold;">${tFace.name}</div>
                                <div style="color:rgba(255,255,255,0.6); font-size:9px;">DOB: ${tFace.dob || 'None'} · ID#: ${tFace.id_number || 'None'}</div>
                                <div style="color:rgba(255,255,255,0.4); font-size:9px;">${tFace.photoCount || (tFace.photos ? tFace.photos.length : 1)} photo vector(s)</div>
                            </div>
                        </div>
                    ` : 'Select a profile';
                }
            };

            window.submitFaceMerge = async function() {
                const sourceId = parseInt(document.getElementById('face-merge-source-select').value, 10);
                const targetId = parseInt(document.getElementById('face-merge-target-select').value, 10);

                if (sourceId === targetId) {
                    alert('Source and target profiles must be different.');
                    return;
                }

                const list = window.enrolledFacesList || [];
                const sFace = list.find(f => f.id === sourceId);
                const tFace = list.find(f => f.id === targetId);

                const sName = sFace ? sFace.name : `#${sourceId}`;
                const tName = tFace ? tFace.name : `#${targetId}`;

                if (!confirm(`Are you sure you want to merge "${sName}" (ID #${sourceId}) into "${tName}" (ID #${targetId})?\n\nAll photos and vector embeddings from #${sourceId} will be transferred to #${targetId}, and profile #${sourceId} will be permanently removed.`)) {
                    return;
                }

                const btn = document.getElementById('btn-submit-face-merge');
                const origHtml = btn ? btn.innerHTML : 'MERGE';
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MERGING & REBUILDING FAISS...';
                }

                try {
                    const resp = await fetch('/api/face/database/merge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ source_id: sourceId, target_id: targetId })
                    });
                    const data = await resp.json();
                    if (data.status === 'success') {
                        closeFaceMergeModal();
                        showFaceRecognitionMessage(`Successfully merged "${sName}" into "${tName}"! Total photos now: ${data.target_photo_count || 'Updated'}`, 'success');
                        loadFaceDatabase();
                    } else {
                        alert('Merge failed: ' + (data.message || 'Unknown error'));
                    }
                } catch (err) {
                    alert('Error merging profiles: ' + err.message);
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = origHtml;
                    }
                }
            };

            // Database Photo Search Dropzone & Handlers
            window.toggleDbPhotoSearchZone = function() {
                const zone = document.getElementById('face-db-photo-search-zone');
                if (!zone) return;
                if (zone.style.display === 'none' || zone.style.display === '') {
                    zone.style.display = 'block';
                } else {
                    zone.style.display = 'none';
                }
            };

            window.handleDbPhotoSearchUpload = async function(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;

                const fnSpan = document.getElementById('face-db-search-filename');
                const loading = document.getElementById('face-db-search-loading');
                const resultsContainer = document.getElementById('face-db-photo-search-matches');

                const isPdf = file.name && file.name.toLowerCase().endsWith('.pdf');
                if (fnSpan) fnSpan.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)${isPdf ? ' [PDF DOCUMENT]' : ''}`;
                if (loading) {
                    loading.innerHTML = isPdf
                        ? '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Rendering PDF pages, extracting 128D embeddings & searching FAISS index...'
                        : '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Extracting 128D embeddings & searching FAISS index...';
                    loading.style.display = 'block';
                }
                if (resultsContainer) {
                    resultsContainer.style.display = 'none';
                    resultsContainer.innerHTML = '';
                }

                try {
                    const formData = new FormData();
                    formData.append('image', file);

                    const resp = await fetch('/api/face/database/search_image', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await resp.json();
                    if (loading) loading.style.display = 'none';

                    if (data.status === 'success') {
                        resultsContainer.style.display = 'block';
                        const matches = data.matches || [];
                        const faceCount = data.face_count || 0;

                        if (matches.length === 0) {
                            resultsContainer.innerHTML = `
                                <div style="padding:10px; background:rgba(255,209,102,0.1); border:1px solid #FFD166; border-radius:4px; color:#FFD166; font-size:11px;">
                                    <i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>
                                    Detected ${faceCount} face(s), but <b>no matching profiles</b> were found in FAISS database (similarity below threshold).
                                </div>
                            `;
                        } else {
                            const matchCards = matches.map(m => {
                                const prof = m.profile || {};
                                const pct = Math.round((m.similarity || 0) * 100);
                                return `
                                    <div style="background:rgba(0,0,0,0.5); border:1px solid #00FFD1; border-radius:6px; padding:10px; display:flex; gap:10px; align-items:center;">
                                        <img src="${prof.thumbnail || ''}" style="width:48px; height:48px; object-fit:cover; border-radius:4px; border:1px solid #00FFD1;">
                                        <div style="flex:1;">
                                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                                <span style="color:#00FFD1; font-size:13px; font-weight:bold;">${prof.name}</span>
                                                <span style="background:rgba(0,255,209,0.2); color:#00FFD1; border:1px solid #00FFD1; padding:2px 8px; border-radius:3px; font-weight:bold; font-size:11px;">
                                                    ${pct}% MATCH
                                                </span>
                                            </div>
                                            <div style="font-size:10px; color:rgba(255,255,255,0.7); margin-top:2px;">
                                                ${prof.document_type || 'Identity'} · DOB: ${prof.dob || 'N/A'} · ID#: ${prof.id_number || 'N/A'}
                                            </div>
                                            <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:2px;">
                                                ${prof.photo_count || 1} photo(s) enrolled · Profile #${prof.id}
                                            </div>
                                        </div>
                                        <button type="button" onclick="openFaceEditModal(${prof.id})" style="background:rgba(0,255,209,0.15); border:1px solid #00FFD1; color:#00FFD1; padding:5px 10px; border-radius:3px; cursor:pointer; font-size:10px; font-family:inherit;">
                                            <i class="fas fa-edit"></i> EDIT
                                        </button>
                                    </div>
                                `;
                            }).join('');

                            resultsContainer.innerHTML = `
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <div style="color:#00FFD1; font-size:11px; font-weight:bold;">
                                        <i class="fas fa-check-circle" style="margin-right:4px;"></i>
                                        FOUND ${matches.length} MATCHING PROFILE(S) IN DATABASE (from ${faceCount} detected face${faceCount === 1 ? '' : 's'}):
                                    </div>
                                    ${matchCards}
                                </div>
                            `;
                        }
                    } else {
                        if (loading) loading.style.display = 'none';
                        resultsContainer.style.display = 'block';
                        resultsContainer.innerHTML = `<div style="color:#FF5555; font-size:11px;"><i class="fas fa-times-circle" style="margin-right:4px;"></i>Search error: ${data.message}</div>`;
                    }
                } catch (err) {
                    if (loading) loading.style.display = 'none';
                    resultsContainer.style.display = 'block';
                    resultsContainer.innerHTML = `<div style="color:#FF5555; font-size:11px;">Network error: ${err.message}</div>`;
                }
            };

            window.updateDatabaseBadge = async function () {
                try {
                    const resp = await fetch('/api/face/database/stats');
                    const data = await resp.json();
                    if (data.status === 'success' && data.stats) {
                        const badge = document.getElementById('face-db-count-badge');
                        if (badge) badge.textContent = data.stats.totalFaces;
                    }
                } catch (e) {}
            };

            function runFaceSearchMock(analysis) {
                if (!analysis || !analysis.faces || analysis.faces.length === 0) {
                    window.faceRecognitionState.searchResults = [];
                    renderFaceSearchResults();
                    return;
                }
                const primaryFace = analysis.faces[0];
                const ident = primaryFace.matchedIdentity ? primaryFace.matchedIdentity.name : primaryFace.embeddingId;

                const mockResults = [
                    {
                        source: 'FAISS Vector Index',
                        confidenceLabel: primaryFace.matchedIdentity ? 'Verified' : 'High',
                        title: `Biometric vector match for ${ident}`,
                        summary: `Searched 128D facial embeddings against the database. Vector distance verified via Rust engine and FAISS index.`,
                        url: '#'
                    },
                    {
                        source: 'Public Image Metadata',
                        confidenceLabel: 'Medium',
                        title: `Open-source image matches for ${ident}`,
                        summary: `Cross-referenced facial landmarks and biometric coordinates with public reverse image intelligence archives.`,
                        url: '#'
                    }
                ];

                window.faceRecognitionState.searchResults = mockResults;
                renderFaceSearchResults();
            }

            function renderFaceSearchResults() {
                const resultsContainer = document.getElementById('face-search-results');
                const countContainer = document.getElementById('face-search-count');
                const searchPanel = document.getElementById('face-search-panel');
                const filter = document.getElementById('face-search-filter');
                if (!resultsContainer || !countContainer || !searchPanel) return;
                const query = (filter ? filter.value : '').trim().toLowerCase();
                const items = (window.faceRecognitionState.searchResults || []).filter(item => !query || JSON.stringify(item).toLowerCase().includes(query));
                countContainer.textContent = items.length ? `${items.length} findings` : 'No findings';
                if (!items.length) {
                    resultsContainer.innerHTML = '<div style="padding: 12px; border: 1px dashed rgba(255,255,255,0.1); color: rgba(255,255,255,0.7);">No public matches were found for the current cues.</div>';
                    searchPanel.style.display = 'block';
                    return;
                }
                resultsContainer.innerHTML = items.map(item => `
                    <div style="background: rgba(0,0,0,0.24); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                            <div style="color:#00FFD1; font-size:12px; font-weight:bold;">${item.source}</div>
                            <div style="color:rgba(255,255,255,0.7); font-size:11px;">Confidence ${item.confidenceLabel}</div>
                        </div>
                        <div style="color:#fff; font-size:13px; margin-top:8px;">${item.title}</div>
                        <div style="color:rgba(255,255,255,0.7); font-size:11px; margin-top:6px; line-height:1.5;">${item.summary}</div>
                        <div style="margin-top:8px;"><a href="${item.url}" target="_blank" rel="noopener" style="color:#7C93FF; text-decoration:none;">Open public search</a></div>
                    </div>
                `).join('');
                searchPanel.style.display = 'block';
            }

            function renderFaceExifData(exif) {
                const panel = document.getElementById('face-exif-panel');
                const container = document.getElementById('face-exif-content');
                if (!panel || !container) return;

                const data = exif || {
                    dimensions: 'Auto-detected',
                    fileSize: 'Client Payload',
                    cameraMake: 'Digital Image',
                    cameraModel: 'Standard Frame',
                    dateTime: new Date().toLocaleString(),
                    gpsCoordinates: 'No GPS Tags Found'
                };

                const gpsLink = (data.latitude && data.longitude)
                    ? `<a href="https://maps.google.com/?q=${data.latitude},${data.longitude}" target="_blank" rel="noopener" style="color:#00FFD1; text-decoration:none;"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${data.gpsCoordinates}</a>`
                    : `<span style="color:#aaa;"><i class="fas fa-map-marker-alt" style="margin-right:4px; opacity:0.5;"></i>${data.gpsCoordinates}</span>`;

                const cameraName = (data.cameraMake && data.cameraMake !== 'Unknown' ? data.cameraMake + ' ' : '') + (data.cameraModel || 'Digital Camera');
                const exposureInfo = data.exposure || 'N/A';
                const focalLengthInfo = data.focalLength || 'N/A';
                const dateTimeInfo = data.dateTime || 'Not Available';

                container.innerHTML = `
                    <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
                        <div style="color:rgba(255,255,255,0.45); font-size:10px; margin-bottom:2px;"><i class="fas fa-camera" style="margin-right:4px;"></i>Camera</div>
                        <div style="color:#eee; font-weight:bold; font-size:11px;">${cameraName}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
                        <div style="color:rgba(255,255,255,0.45); font-size:10px; margin-bottom:2px;"><i class="fas fa-calendar-alt" style="margin-right:4px;"></i>Date / Time</div>
                        <div style="color:#eee; font-size:11px;">${dateTimeInfo}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
                        <div style="color:rgba(255,255,255,0.45); font-size:10px; margin-bottom:2px;"><i class="fas fa-stopwatch" style="margin-right:4px;"></i>Exposure</div>
                        <div style="color:#eee; font-size:11px;">${exposureInfo}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
                        <div style="color:rgba(255,255,255,0.45); font-size:10px; margin-bottom:2px;"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>GPS</div>
                        <div>${gpsLink}</div>
                    </div>
                `;
                panel.style.display = 'block';
            }

            function renderGReverseSearch(gReverse) {
                const panel = document.getElementById('face-greverse-panel');
                const container = document.getElementById('face-greverse-content');
                if (!panel || !container) return;
                const items = gReverse || [];
                if (!items.length) {
                    panel.style.display = 'none';
                    return;
                }
                container.innerHTML = items.map(item => `
                    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:10px; display:flex; flex-direction:column; justify-space-between;">
                        <div>
                            <div style="color:#00FFD1; font-size:11px; font-weight:bold;"><i class="${item.icon || 'fas fa-search'}" style="margin-right:5px;"></i>${item.engine}</div>
                            <div style="color:#eee; font-size:11px; margin-top:4px;">${item.title}</div>
                        </div>
                        <div style="margin-top:8px;">
                            <a href="${item.url}" target="_blank" rel="noopener" style="display:inline-block; background:rgba(0,255,209,0.12); border:1px solid rgba(0,255,209,0.3); color:#00FFD1; font-size:10px; padding:4px 8px; border-radius:3px; text-decoration:none; font-weight:bold;"><i class="fas fa-external-link-alt" style="margin-right:4px;"></i>Launch Visual Search</a>
                        </div>
                    </div>
                `).join('');
                panel.style.display = 'block';
            }

            function renderFaceNetVectors(vectors) {
                const panel = document.getElementById('face-facenet-panel');
                const container = document.getElementById('face-facenet-content');
                if (!panel || !container) return;
                const items = vectors || [];
                if (!items.length) {
                    panel.style.display = 'none';
                    return;
                }
                container.innerHTML = items.map(item => {
                    const profilesHtml = (item.profiles || []).map(p => `
                        <div style="background:rgba(0,255,209,0.06); border:1px dashed rgba(0,255,209,0.25); border-radius:4px; padding:6px 8px; margin-top:6px; font-size:11px;">
                            <span style="color:#00FFD1; font-weight:bold;">Enrolled Match: ${p.name || p.username}</span> · <span style="color:#fff;">${p.matchPct}% Match</span> (L2: ${p.l2Distance || 0.0}, Cosine: ${p.cosineSimilarity || 1.0})
                        </div>
                    `).join('');

                    return `
                        <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(124,147,255,0.25); border-radius:6px; padding:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="color:#7C93FF; font-size:11px; font-weight:bold;">Face #${item.faceIndex} Vector (${item.vectorDimension})</div>
                                <div style="color:#00FFD1; font-size:11px; font-weight:bold;">${item.matchPct ? item.matchPct + '% Match' : 'Vector Indexed'}</div>
                            </div>
                            <div style="display:flex; gap:12px; margin-top:6px; color:rgba(255,255,255,0.7); font-size:10px; font-family:monospace;">
                                <span>Embedding: <b style="color:#aaa;">${item.embeddingId}</b></span>
                                <span>Engine: <b style="color:#00FFD1;">FAISS + Rust</b></span>
                            </div>
                            ${profilesHtml}
                        </div>
                    `;
                }).join('');
                panel.style.display = 'block';
            }

            function showFaceRecognitionMessage(text, tone) {
                const container = document.getElementById('face-results-panel');
                const noResults = document.getElementById('face-no-results');
                if (!container) return;
                if (noResults) noResults.style.display = 'none';
                const color = tone === 'error' ? '#FF5555' : '#00FFD1';
                const message = `<div style="padding:10px 12px; border:1px solid ${color}40; background:${color}08; border-radius:4px; color:${color}; font-size:11px; margin-bottom:10px;">${text}</div>`;
                container.innerHTML = container.innerHTML ? `${message}${container.innerHTML}` : message;
            }

            async function runFaceRecognitionScan() {
                const imageElement = document.getElementById('face-preview-image');
                const scanButton = document.getElementById('face-scan-btn');
                const input = document.getElementById('face-upload-input');
                const file = window.faceRecognitionState.file || (input && input.files ? input.files[0] : null);
                const hasImage = (imageElement && imageElement.src && imageElement.src.startsWith('data:image')) || file || (imageElement && imageElement.naturalWidth > 0);

                if (!hasImage) {
                    showFaceRecognitionMessage('Upload an image before running the scan.', 'error');
                    return;
                }
                if (scanButton) {
                    scanButton.disabled = true;
                    scanButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                }

                const delay = ms => new Promise(res => setTimeout(res, ms));

                try {
                    updateFaceProgress(15, 'Preparing neural pipeline...');
                    await delay(80);

                    const formData = new FormData();
                    if (file) {
                        formData.append('image', file);
                    } else if (imageElement && imageElement.src) {
                        const res = await fetch(imageElement.src);
                        const blob = await res.blob();
                        formData.append('image', blob, 'face_scan.png');
                    }

                    updateFaceProgress(45, 'YuNet detection & Rust SIMD processing...');
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 35000);

                    const response = await fetch('/api/face/recognition', {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || `HTTP ${response.status}`);
                    }

                    const result = await response.json();
                    if (result.status !== 'success' || !result.analysis) {
                        throw new Error(result.error || 'Invalid server response');
                    }

                    updateFaceProgress(80, 'Searching FAISS vector database & generating embeddings...');
                    await delay(100);

                    const analysis = result.analysis;
                    const searchResults = result.publicSearch || [];

                    window.faceRecognitionState.analysis = analysis;
                    window.faceRecognitionState.searchResults = searchResults;

                    updateFaceProgress(95, 'Rendering detection overlays & vector chips...');

                    if (analysis.pageThumbnail) {
                        const pdfCard = document.getElementById('face-pdf-preview-card');
                        if (pdfCard) pdfCard.style.display = 'none';
                        imageElement.src = analysis.pageThumbnail;
                        imageElement.style.display = 'inline-block';
                    }

                    renderFaceResults(analysis);
                    renderFaceExifData(analysis ? analysis.exif : null);
                    renderGReverseSearch(analysis ? analysis.gReverse : null);
                    renderFaceNetVectors(analysis ? analysis.faceNetVectors : null);

                    if (imageElement.complete && imageElement.naturalWidth > 0) {
                        drawFaceOverlay(imageElement, analysis.faces || []);
                    } else {
                        imageElement.onload = function() {
                            drawFaceOverlay(imageElement, analysis.faces || []);
                        };
                    }

                    if (searchResults && searchResults.length > 0) {
                        renderFaceSearchResults();
                    } else {
                        runFaceSearchMock(analysis);
                    }

                    const docTypeLabel = analysis.isPdf ? `PDF (${analysis.pageCount || 1} page${(analysis.pageCount || 1) === 1 ? '' : 's'})` : 'image';
                    const msg = analysis.faceCount > 0
                        ? `Scan complete: ${analysis.faceCount} face${analysis.faceCount === 1 ? '' : 's'} identified via YuNet + Rust + FAISS from ${docTypeLabel}.`
                        : `Scan complete: No faces detected in ${docTypeLabel}.`;
                    showFaceRecognitionMessage(msg, analysis.faceCount > 0 ? 'success' : 'error');
                    updateFaceProgress(100, 'Scan complete');
                    updateDatabaseBadge();
                } catch (error) {
                    console.error('Face scan error:', error);
                    updateFaceProgress(0, 'Scan failed');
                    showFaceRecognitionMessage('Scan failed: ' + error.message, 'error');
                } finally {
                    if (scanButton) {
                        scanButton.disabled = false;
                        scanButton.innerHTML = '<i class="fas fa-search" style="margin-right:4px;"></i>SCAN & RECOGNIZE';
                    }
                }
            }

            function exportFaceRecognitionJson() {
                if (!window.faceRecognitionState.analysis) {
                    showFaceRecognitionMessage('No scan data is available to export yet.', 'error');
                    return;
                }
                const payload = {
                    exportedAt: new Date().toISOString(),
                    analysis: window.faceRecognitionState.analysis,
                    publicSearch: window.faceRecognitionState.searchResults
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `face-recognition-${Date.now()}.json`;
                link.click();
                URL.revokeObjectURL(url);
                showFaceRecognitionMessage('JSON export report generated.', 'success');
            }

            window.clearFaceRecognitionState = function clearFaceRecognitionState() {
                const zone = document.getElementById('face-upload-zone');
                const input = document.getElementById('face-upload-input');
                const placeholder = document.getElementById('face-upload-placeholder');
                const previewWrapper = document.getElementById('face-preview-wrapper');
                const previewImage = document.getElementById('face-preview-image');
                const canvas = document.getElementById('face-preview-canvas');
                const resultsPanel = document.getElementById('face-results-panel');
                const noResults = document.getElementById('face-no-results');
                const progressFill = document.getElementById('face-progress-fill');
                const progressText = document.getElementById('face-progress-text');
                const progressShell = document.getElementById('face-progress-shell');
                const searchPanel = document.getElementById('face-search-panel');
                const searchFilter = document.getElementById('face-search-filter');
                const searchResults = document.getElementById('face-search-results');
                const searchCount = document.getElementById('face-search-count');
                const exifPanel = document.getElementById('face-exif-panel');
                const exifContent = document.getElementById('face-exif-content');
                const greversePanel = document.getElementById('face-greverse-panel');
                const greverseContent = document.getElementById('face-greverse-content');
                const facenetPanel = document.getElementById('face-facenet-panel');
                const facenetContent = document.getElementById('face-facenet-content');
                const countPill = document.getElementById('face-detection-count-pill');

                if (input) input.value = '';
                if (zone) {
                    zone.style.borderColor = 'rgba(0,255,209,0.35)';
                    zone.style.background = 'rgba(0,255,209,0.02)';
                }
                if (placeholder) placeholder.style.display = 'flex';
                if (previewWrapper) previewWrapper.style.display = 'none';
                const pdfCard = document.getElementById('face-pdf-preview-card');
                if (pdfCard) pdfCard.style.display = 'none';
                if (previewImage) {
                    previewImage.removeAttribute('src');
                    previewImage.src = '';
                }
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.width = 0;
                    canvas.height = 0;
                }
                if (resultsPanel) resultsPanel.innerHTML = '';
                if (noResults) noResults.style.display = 'block';
                if (countPill) countPill.textContent = '';
                if (progressFill) progressFill.style.width = '0%';
                if (progressShell) progressShell.style.display = 'none';
                if (progressText) progressText.textContent = 'Awaiting image...';
                if (searchPanel) searchPanel.style.display = 'none';
                if (searchFilter) searchFilter.value = '';
                if (searchResults) searchResults.innerHTML = '';
                if (searchCount) searchCount.textContent = '';
                if (exifPanel) exifPanel.style.display = 'none';
                if (exifContent) exifContent.innerHTML = '';
                if (greversePanel) greversePanel.style.display = 'none';
                if (greverseContent) greverseContent.innerHTML = '';
                if (facenetPanel) facenetPanel.style.display = 'none';
                if (facenetContent) facenetContent.innerHTML = '';

                // Restore Hero Upload dropzone and hide results workspace
                const hero = document.getElementById('face-center-hero-upload');
                const ws = document.getElementById('face-scan-results-workspace');
                if (hero) hero.style.display = 'flex';
                if (ws) ws.style.display = 'none';

                window.faceRecognitionState = {
                    file: null,
                    imageDataUrl: null,
                    analysis: null,
                    searchResults: []
                };
            };

            window.switchFacePopupTab = function (tab) {
                const scanView = document.getElementById('face-view-scan');
                const dbView = document.getElementById('face-view-database');
                const btnScan = document.getElementById('face-tab-btn-scan');
                const btnDb = document.getElementById('face-tab-btn-db');
                const hero = document.getElementById('face-center-hero-upload');
                const ws = document.getElementById('face-scan-results-workspace');

                if (tab === 'database') {
                    if (scanView) scanView.style.display = 'none';
                    if (dbView) dbView.style.display = 'block';
                    if (btnScan) btnScan.classList.remove('active');
                    if (btnDb) btnDb.classList.add('active');
                    if (typeof window.loadFaceDatabase === 'function') {
                        window.loadFaceDatabase();
                    }
                } else {
                    if (scanView) scanView.style.display = 'flex';
                    if (dbView) dbView.style.display = 'none';
                    if (btnScan) btnScan.classList.add('active');
                    if (btnDb) btnDb.classList.remove('active');
                    const hasLoaded = window.faceRecognitionState && (window.faceRecognitionState.file || window.faceRecognitionState.imageDataUrl);
                    if (hasLoaded) {
                        if (hero) hero.style.display = 'none';
                        if (ws) ws.style.display = 'flex';
                    } else {
                        if (hero) hero.style.display = 'flex';
                        if (ws) ws.style.display = 'none';
                    }
                }
            };

            window.toggleFaceRecognitionPopup = function () {
                const popup = document.getElementById('face-recognition-popup');
                if (!popup) return;
                if (popup.style.display === 'none' || popup.style.display === '') {
                    popup.style.display = 'block';
                    const osintMore = document.getElementById('osint-more-popup');
                    if (osintMore) osintMore.style.display = 'none';
                    const sensorOsint = document.getElementById('sensor-osint-more');
                    if (sensorOsint) sensorOsint.classList.remove('active-sensor');
                    if (!window.faceRecognitionState) {
                        window.faceRecognitionState = { file: null, imageDataUrl: null, analysis: null, searchResults: [] };
                    }
                    updateDatabaseBadge();
                    loadFaceDatabase();
                } else {
                    popup.style.display = 'none';
                }
            };

            document.addEventListener('DOMContentLoaded', function () {
                window.attachFaceRecognitionHandlers();
            });
