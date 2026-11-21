"""
HayOS PDF Document Intelligence & Page Extraction Service
Handles PDF uploads seamlessly for Face Recognition & ID Detection:
  - Fast, multi-page vector rendering via Poppler (pdftoppm) C++ SIMD engine
  - Direct native PDF text stream extraction (pdftotext / pypdf) with layout preservation
  - Embedded raw biometric image extraction (original sensor resolution ID photos)
  - Seamless fallback to PyPDF / PIL if system Poppler CLI is busy or unavailable
"""

import os
import io
import base64
import tempfile
import subprocess
import cv2
import numpy as np
from PIL import Image

try:
    from pypdf import PdfReader
    _PYPDF_AVAILABLE = True
except ImportError:
    _PYPDF_AVAILABLE = False


def is_pdf_data(data: bytes, filename: str = '') -> bool:
    """Detect if provided byte stream or filename is a PDF document."""
    if filename and filename.lower().endswith('.pdf'):
        return True
    if data and len(data) >= 5 and data[:5] == b'%PDF-':
        return True
    return False


def extract_pdf_direct_text(pdf_bytes: bytes) -> str:
    """Extract direct text stream from PDF using pdftotext or pypdf."""
    # Method 1: pdftotext CLI (fast, preserves layout)
    try:
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as tmp:
            tmp.write(pdf_bytes)
            tmp.flush()
            res = subprocess.run(['pdftotext', '-layout', tmp.name, '-'], capture_output=True, text=True, timeout=8)
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
    except Exception:
        pass

    # Method 2: pypdf pure Python fallback
    if _PYPDF_AVAILABLE:
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    text_parts.append(txt)
            if text_parts:
                return "\n\n".join(text_parts).strip()
        except Exception:
            pass

    return ""


def render_pdf_pages(pdf_bytes: bytes, max_pages: int = 5, dpi: int = 180) -> dict:
    """
    Render PDF pages to high-resolution OpenCV BGR images and extract text.
    Returns:
      {
         'pages': [ { 'page_number': 1, 'image_bytes': ..., 'image_bgr': ..., 'width': ..., 'height': ..., 'thumbnail': ... } ],
         'pageCount': int,
         'primaryImageBytes': bytes,
         'primaryThumbnail': str (data:image/png;base64,...),
         'directText': str,
         'embeddedPhotos': [ { 'bytes': ..., 'bgr': ... } ]
      }
    """
    pages = []
    embedded_photos = []
    direct_text = extract_pdf_direct_text(pdf_bytes)

    # Strategy 1: pdftoppm (C++ Poppler engine)
    rendered_via_poppler = False
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, 'doc.pdf')
        with open(pdf_path, 'wb') as f:
            f.write(pdf_bytes)

        prefix = os.path.join(tmpdir, 'p')
        try:
            cmd = ['pdftoppm', '-png', '-r', str(dpi), '-f', '1', '-l', str(max_pages), pdf_path, prefix]
            res = subprocess.run(cmd, capture_output=True, timeout=15)
            if res.returncode == 0:
                files = sorted([f for f in os.listdir(tmpdir) if f.startswith('p-') and f.endswith('.png')])
                for idx, fname in enumerate(files):
                    fpath = os.path.join(tmpdir, fname)
                    with open(fpath, 'rb') as pf:
                        img_bytes = pf.read()
                    bgr = cv2.imread(fpath)
                    if bgr is not None:
                        h, w = bgr.shape[:2]
                        b64 = "data:image/png;base64," + base64.b64encode(img_bytes).decode('utf-8')
                        pages.append({
                            'page_number': idx + 1,
                            'image_bytes': img_bytes,
                            'image_bgr': bgr,
                            'width': w,
                            'height': h,
                            'thumbnail': b64
                        })
                if pages:
                    rendered_via_poppler = True
        except Exception as e:
            print(f"[PDF Service] pdftoppm execution note: {e}")

    # Strategy 2: Extract embedded raster images via PyPDF
    if _PYPDF_AVAILABLE:
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            for p_idx, page in enumerate(reader.pages[:max_pages]):
                try:
                    for img_obj in page.images:
                        raw_img_bytes = img_obj.data
                        nparr = np.frombuffer(raw_img_bytes, np.uint8)
                        emb_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        if emb_bgr is not None:
                            eh, ew = emb_bgr.shape[:2]
                            if ew >= 60 and eh >= 60:  # Valid photo size
                                embedded_photos.append({
                                    'page': p_idx + 1,
                                    'bytes': raw_img_bytes,
                                    'image_bgr': emb_bgr,
                                    'width': ew,
                                    'height': eh
                                })
                except Exception:
                    pass
        except Exception as e:
            print(f"[PDF Service] Embedded image extraction note: {e}")

    # If pdftoppm failed but we found embedded images, use the largest embedded image as page 1
    if not pages and embedded_photos:
        best_emb = max(embedded_photos, key=lambda x: x['width'] * x['height'])
        b64 = "data:image/jpeg;base64," + base64.b64encode(best_emb['bytes']).decode('utf-8')
        pages.append({
            'page_number': 1,
            'image_bytes': best_emb['bytes'],
            'image_bgr': best_emb['image_bgr'],
            'width': best_emb['width'],
            'height': best_emb['height'],
            'thumbnail': b64
        })

    if not pages:
        raise ValueError("Could not render or extract images from the provided PDF file.")

    primary_page = pages[0]
    total_page_count = len(pages)
    if _PYPDF_AVAILABLE:
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            total_page_count = len(reader.pages)
        except Exception:
            pass

    return {
        'pages': pages,
        'pageCount': total_page_count,
        'primaryImageBytes': primary_page['image_bytes'],
        'primaryImageBgr': primary_page['image_bgr'],
        'primaryThumbnail': primary_page['thumbnail'],
        'directText': direct_text,
        'embeddedPhotos': embedded_photos
    }
