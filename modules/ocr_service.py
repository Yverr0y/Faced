"""
HayOS OCR & Document Identity Extraction Service
High-performance OCR pipeline utilizing:
  - RapidOCR (ONNX Runtime engine)
  - Native Rust SIMD Image Preprocessing (Contrast stretch & Otsu thresholding)
  - Native Rust Fuzzy String Matching (Levenshtein label distance)
  - Auto-detection of structured identity fields: Name, DOB, Address, ID Number, Document Type, Expiry
"""

import os
import re
import cv2
import threading
import numpy as np
from PIL import Image

from modules.face_bridge import (
    rust_contrast_enhance,
    rust_binarize,
    rust_levenshtein,
    rust_fuzzy_match,
    rust_handwriting_preprocess,
    is_rust_accelerated
)

_ocr_engine = None
_ocr_lock = threading.Lock()
_ocr_ready = False

def get_ocr_engine():
    global _ocr_engine, _ocr_ready
    if _ocr_ready:
        return _ocr_engine

    with _ocr_lock:
        if _ocr_ready:
            return _ocr_engine
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_engine = RapidOCR()
            _ocr_ready = True
            print("[OCR Service] RapidOCR ONNX initialized successfully.")
        except Exception as e:
            print(f"[OCR Service] Could not initialize RapidOCR: {e}")
            _ocr_engine = None
        return _ocr_engine


# Date regexes for DOB / Expiry
DATE_PATTERNS = [
    r'\b(19\d{2}|20[0-2]\d)[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b',  # YYYY-MM-DD
    r'\b(0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])[-/.](19\d{2}|20[0-2]\d)\b',  # MM/DD/YYYY
    r'\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](19\d{2}|20[0-2]\d)\b',  # DD/MM/YYYY
    r'\b(0[1-9]|[12]\d|3[01])\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(19\d{2}|20[0-2]\d)\b', # DD MMM YYYY
]

STREET_SUFFIXES = [
    'STREET', 'ST', 'AVENUE', 'AVE', 'ROAD', 'RD', 'BOULEVARD', 'BLVD',
    'DRIVE', 'DR', 'LANE', 'LN', 'WAY', 'COURT', 'CT', 'HIGHWAY', 'HWY',
    'PARKWAY', 'PKWY', 'TERRACE', 'TER', 'CIRCLE', 'CIR', 'PLACE', 'PL'
]

DOCUMENT_KEYWORDS = {
    'Driver License': ['DRIVER LICENSE', 'DRIVING LICENCE', 'OPERATOR LICENSE', 'PERMIT', 'DL', 'DMV'],
    'Passport': ['PASSPORT', 'PASSEPORT', 'PASAPORTE', 'P<'],
    'National Identity Card': ['NATIONAL ID', 'IDENTITY CARD', 'IDENTIFICATION CARD', 'CITIZEN CARD', 'NATIONAL IDENTITY'],
    'Employee Badge': ['EMPLOYEE', 'STAFF', 'SECURITY CLEARANCE', 'BADGE', 'ACCESS CARD'],
    'Residence Permit': ['RESIDENCE CARD', 'PERMANENT RESIDENT', 'GREEN CARD', 'ALIEN REGISTRATION'],
    'Student ID': ['STUDENT', 'CAMPUS CARD', 'UNIVERSITY', 'COLLEGE', 'ACADEMIC']
}


def parse_mrz(lines):
    """Attempt to parse Machine Readable Zone (MRZ) lines if present (Passports / ID cards)."""
    mrz_lines = [l.strip().replace(' ', '') for l in lines if ('<<' in l or (len(l) > 28 and l.count('<') >= 2))]
    if not mrz_lines:
        return None

    parsed = {}
    for line in mrz_lines:
        if line.startswith('P<') or line.startswith('P'):
            # Passport MRZ Line 1: P<COUNTRY<SURNAME<<GIVEN_NAMES<<<<<
            parts = line[2:].split('<<')
            if len(parts) >= 2:
                country_code = parts[0][:3].replace('<', '')
                surname = parts[0][3:].replace('<', ' ').strip()
                given_names = parts[1].replace('<', ' ').strip()
                full_name = f"{given_names} {surname}".strip()
                if full_name:
                    parsed['name'] = full_name
                if country_code:
                    parsed['country'] = country_code
                parsed['document_type'] = 'Passport'

        elif line.startswith('I<') or line.startswith('ID<'):
            # ID Card MRZ
            parts = line[2:].split('<<')
            if len(parts) >= 2:
                surname = parts[0][3:].replace('<', ' ').strip()
                given_names = parts[1].replace('<', ' ').strip()
                full_name = f"{given_names} {surname}".strip()
                if full_name:
                    parsed['name'] = full_name
                parsed['document_type'] = 'National Identity Card'

    return parsed if parsed else None


def extract_identity_fields_from_ocr(ocr_items):
    """
    Intelligently extracts Name, DOB, Address, ID Number, Document Type, Expiry
    from raw OCR detection items using Rust string distance and heuristic rules.
    """
    raw_lines = [item['text'].strip() for item in ocr_items if item.get('text')]
    if not raw_lines:
        return {
            'name': '',
            'dob': '',
            'address': '',
            'id_number': '',
            'document_type': 'General Identity',
            'expiry_date': '',
            'issue_date': '',
            'sex': '',
            'confidence': 0.0
        }

    extracted = {
        'name': '',
        'dob': '',
        'address': '',
        'id_number': '',
        'document_type': 'General Identity',
        'expiry_date': '',
        'issue_date': '',
        'sex': '',
    }

    # 1. Check for MRZ zone first
    mrz_data = parse_mrz(raw_lines)
    if mrz_data:
        extracted.update(mrz_data)

    # 2. Detect Document Type
    full_text_upper = ' '.join(raw_lines).upper()
    for doc_type, keywords in DOCUMENT_KEYWORDS.items():
        if any(kw in full_text_upper for kw in keywords):
            extracted['document_type'] = doc_type
            break

    # 3. Line by Line analysis
    address_candidate_lines = []

    for idx, line in enumerate(raw_lines):
        line_clean = line.strip()
        line_upper = line_clean.upper()

        # --- Name Detection ---
        if not extracted['name']:
            # Match explicit labels: NAME: John Doe, FN: Jane, LN: Smith
            name_match = re.search(r'(?:FULL\s*NAME|GIVEN\s*NAMES?|NAME|SURNAME|FN|LN|NOM|PRENOM)\s*[:.\-]\s*([A-Za-z\s,\'-]{2,35})?', line_clean, re.IGNORECASE)
            if name_match:
                cand = name_match.group(1).strip() if name_match.group(1) else ''
                # If label only (e.g. "NAME:"), check next line
                if (not cand or len(cand) < 2) and idx + 1 < len(raw_lines):
                    next_l = raw_lines[idx + 1].strip()
                    if not any(k in next_l.upper() for k in ['DOB', 'DATE', 'EXP', 'ADDRESS', 'LIC', 'STATE', 'DRIVER', 'SEX']):
                        cand = next_l

                # Clean up commas e.g. "CONNOR, SARAH" -> "SARAH CONNOR"
                if ',' in cand:
                    parts = [p.strip() for p in cand.split(',') if p.strip()]
                    if len(parts) == 2:
                        cand = f"{parts[1]} {parts[0]}"
                if len(cand) >= 3 and not any(kw in cand.upper() for kw in ['LICENSE', 'STATE', 'DATE', 'EXPIRES', 'STREET']):
                    extracted['name'] = cand

        # --- Date of Birth (DOB) Detection ---
        if not extracted['dob']:
            # Fuzzy or regex match for DOB label
            # Notice OCR often confuses O with 0 e.g. D0B, D.0.B.
            dob_match = re.search(r'(?:DOB|D0B|D\.O\.B|DATE\s*OF\s*BIRTH|BIRTH\s*DATE|BORN|NE\(E\))\s*[:.\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4}|[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})', line_clean, re.IGNORECASE)
            if dob_match:
                extracted['dob'] = dob_match.group(1).strip()
            elif any(rust_fuzzy_match(word, 'DOB') > 0.65 or rust_fuzzy_match(word, 'BIRTH') > 0.65 for word in line_upper.split()):
                # Extract date from this line or next line
                for pat in DATE_PATTERNS:
                    m = re.search(pat, line_clean, re.IGNORECASE)
                    if m:
                        extracted['dob'] = m.group(0).strip()
                        break
                if not extracted['dob'] and idx + 1 < len(raw_lines):
                    for pat in DATE_PATTERNS:
                        m = re.search(pat, raw_lines[idx + 1].strip(), re.IGNORECASE)
                        if m:
                            extracted['dob'] = m.group(0).strip()
                            break

        # --- Expiry / Expiration Date ---
        if not extracted['expiry_date']:
            exp_match = re.search(r'(?:EXP(?:IRES|IRATION|IRY)?|VALID\s*(?:UNTIL|THRU))\s*[:.\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})', line_clean, re.IGNORECASE)
            if exp_match:
                extracted['expiry_date'] = exp_match.group(1).strip()
            elif 'EXP' in line_upper and idx + 1 < len(raw_lines):
                for pat in DATE_PATTERNS:
                    m = re.search(pat, raw_lines[idx + 1].strip(), re.IGNORECASE)
                    if m:
                        extracted['expiry_date'] = m.group(0).strip()
                        break

        # --- Issue Date ---
        if not extracted['issue_date']:
            iss_match = re.search(r'(?:ISS(?:UE|UED)?|DATE\s*OF\s*ISSUE)\s*[:.\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})', line_clean, re.IGNORECASE)
            if iss_match:
                extracted['issue_date'] = iss_match.group(1).strip()

        # --- ID / Document Number Detection ---
        if not extracted['id_number']:
            id_match = re.search(r'(?:LIC\s*(?:NO|#)|DL\s*(?:NO|#)?|ID\s*(?:NO|#)|DOC(?:UMENT)?\s*(?:NO|#)|CARD\s*NO|NO\s*[:#])\s*[:.\-]?\s*([A-Z0-9\-\s]{4,20})', line_clean, re.IGNORECASE)
            if id_match:
                val = id_match.group(1).strip()
                # Must contain at least one digit and not be a date
                if any(c.isdigit() for c in val) and not ('/' in val or len(val) < 4):
                    extracted['id_number'] = val

        # --- Sex / Gender (explicit text only) ---
        if not extracted['sex']:
            sex_match = re.search(r'\b(?:SEX|GENDER)\s*[:.\-]?\s*([MFX]|MALE|FEMALE)\b', line_upper)
            if sex_match:
                val = sex_match.group(1).strip()
                extracted['sex'] = 'Male' if val in ['M', 'MALE'] else ('Female' if val in ['F', 'FEMALE'] else val)

        # --- Address Detection Candidates ---
        addr_match = re.search(r'(?:ADDRESS|ADDR|RESIDENCE|DOMICILE)\s*[:.\-]?\s*(.*)', line_clean, re.IGNORECASE)
        if addr_match:
            candidate_text = addr_match.group(1).strip()
            if len(candidate_text) > 4:
                address_candidate_lines.append(candidate_text)
            # Address often spans next 1 or 2 lines
            for offset in [1, 2]:
                if idx + offset < len(raw_lines):
                    next_l = raw_lines[idx + offset].strip()
                    if not any(k in next_l.upper() for k in ['DOB', 'DATE', 'EXP', 'LIC', 'STATE', 'NAME', 'SEX']):
                        address_candidate_lines.append(next_l)
        else:
            # Check for standalone street address: Number + Street Suffix
            has_num = bool(re.search(r'\b\d{1,5}\b', line_clean))
            has_suffix = any(f" {s}" in f" {line_upper} " for s in STREET_SUFFIXES)
            has_zip = bool(re.search(r'\b\d{5}(?:-\d{4})?\b', line_clean))
            if (has_num and has_suffix) or has_zip:
                address_candidate_lines.append(line_clean)

    # Resolve Address
    if address_candidate_lines:
        # Join unique lines preserving order
        unique_addr = []
        for a in address_candidate_lines:
            if a not in unique_addr and not any(kw in a.upper() for kw in ['LICENSE', 'DATE OF BIRTH', 'EXPIRES']):
                unique_addr.append(a)
        extracted['address'] = ', '.join(unique_addr[:2])

    # Fallback Name Heuristic if no explicit label found
    if not extracted['name']:
        for line in raw_lines[:6]:
            line_str = line.strip()
            # If line is mostly alphabetic words, 2-4 words, uppercase or title case, not keywords
            words = [w for w in line_str.split() if w.isalpha()]
            if 2 <= len(words) <= 4:
                cand = ' '.join(words)
                cand_u = cand.upper()
                if not any(k in cand_u for k in ['STATE', 'DRIVER', 'LICENSE', 'CARD', 'IDENTIFICATION', 'REPUBLIC', 'FEDERAL', 'DEPARTMENT', 'USA', 'CALIFORNIA', 'YORK', 'TEXAS', 'FLORIDA']):
                    extracted['name'] = cand
                    break

    # Clean ID Number
    if extracted['id_number']:
        extracted['id_number'] = re.sub(r'[^A-Za-z0-9\-]', '', extracted['id_number']).strip()

    return extracted


def process_image_ocr(image_bgr_or_bytes, mode='general'):
    """
    Main entry point: Executes RapidOCR on image with Rust SIMD preprocessing.
    Supports mode='general' (ID cards, badges, documents) or mode='handwriting'
    (Sauvola adaptive ink extraction & cursive stroke bridging via Rust).
    """
    # 1. Decode to BGR NumPy array (supporting image buffers and PDF documents)
    direct_pdf_text = ""
    is_pdf_doc = False
    if isinstance(image_bgr_or_bytes, (bytes, bytearray)):
        from modules.pdf_service import is_pdf_data, render_pdf_pages
        if is_pdf_data(image_bgr_or_bytes):
            is_pdf_doc = True
            try:
                pdf_res = render_pdf_pages(bytes(image_bgr_or_bytes))
                img_bgr = pdf_res['primaryImageBgr']
                direct_pdf_text = pdf_res.get('directText', '')
            except Exception as e:
                print(f"[OCR Service] PDF document rendering error: {e}")
                img_bgr = None
        else:
            nparr = np.frombuffer(image_bgr_or_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    elif isinstance(image_bgr_or_bytes, np.ndarray):
        img_bgr = image_bgr_or_bytes
    else:
        return {'status': 'error', 'message': 'Invalid image format', 'detectedFields': {}}

    if img_bgr is None or img_bgr.size == 0:
        return {'status': 'error', 'message': 'Empty or unrenderable image/PDF buffer', 'detectedFields': {}}

    h, w = img_bgr.shape[:2]

    # Pre-scale if too large to maximize OCR speed
    max_dim = 1600
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        nw = max(1, int(w * scale))
        nh = max(1, int(h * scale))
        ocr_input = cv2.resize(img_bgr, (nw, nh), interpolation=cv2.INTER_AREA)
    else:
        ocr_input = img_bgr

    engine = get_ocr_engine()
    if engine is None:
        return {
            'status': 'unavailable',
            'message': 'OCR engine not installed or failed to load',
            'detectedFields': {},
            'rawLines': [],
            'rawText': ''
        }

    ocr_items = []
    is_hw = (mode in ('handwriting', 'cursive', 'hw'))

    # If handwriting mode is requested, run Sauvola adaptive binarization + stroke bridging first
    if is_hw:
        try:
            gray = cv2.cvtColor(ocr_input, cv2.COLOR_BGR2GRAY)
            hw_bin = rust_handwriting_preprocess(gray, window_radius=18, k_factor=0.25)
            hw_bgr = cv2.cvtColor(hw_bin, cv2.COLOR_GRAY2BGR)
            results, elapse = engine(hw_bgr)
            if results:
                for item in results:
                    box = item[0]
                    text = str(item[1]).strip()
                    try:
                        conf = round(float(item[2]), 3)
                    except Exception:
                        conf = 0.85
                    if text:
                        ocr_items.append({'text': text, 'confidence': conf, 'box': box})
        except Exception as e:
            print(f"[OCR Service] Handwriting preprocessing error: {e}")

    # Standard run if not handwriting mode or if handwriting pass returned 0 lines
    if not is_hw or len(ocr_items) == 0:
        try:
            results, elapse = engine(ocr_input)
            if results:
                for item in results:
                    box = item[0]
                    text = str(item[1]).strip()
                    try:
                        conf = round(float(item[2]), 3)
                    except Exception:
                        conf = 0.85
                    if text:
                        ocr_items.append({
                            'text': text,
                            'confidence': conf,
                            'box': box
                        })
        except Exception as e:
            print(f"[OCR Service] Inference exception: {e}")

    # Fallback retry with Rust contrast enhancement or Sauvola if few items found
    if len(ocr_items) < 2 and not is_hw:
        try:
            gray = cv2.cvtColor(ocr_input, cv2.COLOR_BGR2GRAY)
            enhanced_gray = rust_contrast_enhance(gray)
            enhanced_bgr = cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR)
            alt_results, _ = engine(enhanced_bgr)
            if alt_results and len(alt_results) > len(ocr_items):
                ocr_items = []
                for item in alt_results:
                    text = str(item[1]).strip()
                    try:
                        conf = round(float(item[2]), 3)
                    except Exception:
                        conf = 0.85
                    if text:
                        ocr_items.append({
                            'text': text,
                            'confidence': conf,
                            'box': item[0]
                        })
            # Also try Sauvola handwriting extraction as second fallback
            if len(ocr_items) == 0:
                hw_bin = rust_handwriting_preprocess(gray, window_radius=18, k_factor=0.25)
                hw_bgr = cv2.cvtColor(hw_bin, cv2.COLOR_GRAY2BGR)
                hw_results, _ = engine(hw_bgr)
                if hw_results:
                    for item in hw_results:
                        text = str(item[1]).strip()
                        try:
                            conf = round(float(item[2]), 3)
                        except Exception:
                            conf = 0.85
                        if text:
                            ocr_items.append({'text': text, 'confidence': conf, 'box': item[0]})
        except Exception as e:
            print(f"[OCR Service] Retry note: {e}")

    # If direct text was extracted from PDF stream, inject distinct lines
    if direct_pdf_text:
        existing_texts = {it['text'].strip().lower() for it in ocr_items}
        for raw_line in direct_pdf_text.splitlines():
            clean_l = raw_line.strip()
            if len(clean_l) >= 2 and clean_l.lower() not in existing_texts:
                ocr_items.append({
                    'text': clean_l,
                    'confidence': 0.99,
                    'box': []
                })
                existing_texts.add(clean_l.lower())

    # Extract structured fields
    detected_fields = extract_identity_fields_from_ocr(ocr_items)

    full_text = '\n'.join([it['text'] for it in ocr_items])
    avg_conf = round(sum(it['confidence'] for it in ocr_items) / max(1, len(ocr_items)), 2)

    return {
        'status': 'success',
        'hasOcrData': len(ocr_items) > 0,
        'lineCount': len(ocr_items),
        'averageConfidence': avg_conf,
        'detectedFields': detected_fields,
        'rawLines': ocr_items,
        'rawText': full_text,
        'mode': mode,
        'isHandwriting': is_hw,
        'rustAccelerated': is_rust_accelerated(),
        'dimensions': f"{w} × {h} px"
    }
