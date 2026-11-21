"""
HayOS Rust Face Engine Bridge
Provides zero-copy, multi-threaded CPU acceleration via Rust (librust_face_rs / Rayon).
Falls back safely to vectorized NumPy if the shared library is not loaded.
"""

import os
import ctypes
import numpy as np

_RUST_LIB = None
_RUST_AVAILABLE = False

_SO_PATHS = [
    os.path.join(os.path.dirname(__file__), 'libfaced_rs.so'),
    os.path.join(os.path.dirname(__file__), 'hayos_face_rs', 'target', 'release', 'libfaced_rs.so'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rust_face_engine', 'target', 'release', 'librust_face_engine.so'),
]

for p in _SO_PATHS:
    if os.path.exists(p):
        try:
            _RUST_LIB = ctypes.CDLL(p)
            _RUST_AVAILABLE = True
            break
        except Exception as e:
            print(f"[Rust Face Engine] Failed to load {p}: {e}")

if _RUST_AVAILABLE and _RUST_LIB:
    try:
        # Signature: rust_face_engine_version() -> i32
        _RUST_LIB.rust_face_engine_version.restype = ctypes.c_int

        # Signature: rust_cosine_similarity(*const f32, *const f32, usize) -> f32
        _RUST_LIB.rust_cosine_similarity.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_size_t
        ]
        _RUST_LIB.rust_cosine_similarity.restype = ctypes.c_float

        # Signature: rust_l2_distance(*const f32, *const f32, usize) -> f32
        _RUST_LIB.rust_l2_distance.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_size_t
        ]
        _RUST_LIB.rust_l2_distance.restype = ctypes.c_float

        # Signature: rust_batch_cosine_similarity(*const f32, *const f32, usize, usize, *mut f32) -> i32
        _RUST_LIB.rust_batch_cosine_similarity.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_size_t,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_float)
        ]
        _RUST_LIB.rust_batch_cosine_similarity.restype = ctypes.c_int

        # Signature: rust_iou_nms(*const f32, usize, f32, *mut i32) -> usize
        _RUST_LIB.rust_iou_nms.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_size_t,
            ctypes.c_float,
            ctypes.POINTER(ctypes.c_int32)
        ]
        _RUST_LIB.rust_iou_nms.restype = ctypes.c_size_t

        # Signature: rust_laplacian_sharpness(*const u8, usize, usize) -> f32
        _RUST_LIB.rust_laplacian_sharpness.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_size_t
        ]
        _RUST_LIB.rust_laplacian_sharpness.restype = ctypes.c_float

        # Signature: rust_otsu_threshold(*const u8, usize, usize) -> u8
        _RUST_LIB.rust_otsu_threshold.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_size_t
        ]
        _RUST_LIB.rust_otsu_threshold.restype = ctypes.c_uint8

        # Signature: rust_contrast_stretch(*const u8, usize, usize, *mut u8) -> i32
        _RUST_LIB.rust_contrast_stretch.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_uint8)
        ]
        _RUST_LIB.rust_contrast_stretch.restype = ctypes.c_int

        # Signature: rust_ocr_binarize(*const u8, usize, usize, *mut u8, i32) -> i32
        _RUST_LIB.rust_ocr_binarize.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_int
        ]
        _RUST_LIB.rust_ocr_binarize.restype = ctypes.c_int

        # Signature: rust_levenshtein_distance(*const c_char, *const c_char) -> usize
        _RUST_LIB.rust_levenshtein_distance.argtypes = [
            ctypes.c_char_p,
            ctypes.c_char_p
        ]
        _RUST_LIB.rust_levenshtein_distance.restype = ctypes.c_size_t

        # Signature: rust_fuzzy_match_score(*const c_char, *const c_char) -> f32
        _RUST_LIB.rust_fuzzy_match_score.argtypes = [
            ctypes.c_char_p,
            ctypes.c_char_p
        ]
        _RUST_LIB.rust_fuzzy_match_score.restype = ctypes.c_float

        # Signature: rust_handwriting_sauvola(*const u8, usize, usize, *mut u8, usize, f32) -> i32
        _RUST_LIB.rust_handwriting_sauvola.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_float
        ]
        _RUST_LIB.rust_handwriting_sauvola.restype = ctypes.c_int

        # Signature: rust_stroke_morph_clean(*const u8, usize, usize, *mut u8) -> i32
        _RUST_LIB.rust_stroke_morph_clean.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_uint8)
        ]
        _RUST_LIB.rust_stroke_morph_clean.restype = ctypes.c_int

        # Signature: rust_multi_vector_match(*const f32, *const f32, usize, usize, *mut f32, *mut usize) -> i32
        _RUST_LIB.rust_multi_vector_match.argtypes = [
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_size_t,
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_float),
            ctypes.POINTER(ctypes.c_size_t)
        ]
        _RUST_LIB.rust_multi_vector_match.restype = ctypes.c_int

        v = _RUST_LIB.rust_face_engine_version()
        print(f"[Rust Face Engine] Initialized successfully. Engine API Version: {v}")
    except Exception as e:
        print(f"[Rust Face Engine] Binding error: {e}")
        _RUST_AVAILABLE = False



def is_rust_accelerated():
    return _RUST_AVAILABLE


def rust_cosine_similarity(vec_a, vec_b):
    """Compute cosine similarity between two 1D float vectors."""
    a = np.ascontiguousarray(vec_a, dtype=np.float32)
    b = np.ascontiguousarray(vec_b, dtype=np.float32)
    if len(a) != len(b) or len(a) == 0:
        return 0.0

    if _RUST_AVAILABLE:
        ptr_a = a.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        ptr_b = b.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        return float(_RUST_LIB.rust_cosine_similarity(ptr_a, ptr_b, len(a)))

    # Fallback to NumPy
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a <= 1e-7 or norm_b <= 1e-7:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def rust_l2_distance(vec_a, vec_b):
    """Compute Euclidean (L2) distance between two 1D float vectors."""
    a = np.ascontiguousarray(vec_a, dtype=np.float32)
    b = np.ascontiguousarray(vec_b, dtype=np.float32)
    if len(a) != len(b) or len(a) == 0:
        return 0.0

    if _RUST_AVAILABLE:
        ptr_a = a.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        ptr_b = b.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        return float(_RUST_LIB.rust_l2_distance(ptr_a, ptr_b, len(a)))

    return float(np.linalg.norm(a - b))


def rust_batch_cosine_similarity(query_vec, db_matrix):
    """
    Compute cosine similarity of query_vec against every vector in db_matrix (N x D).
    Returns 1D numpy array of shape (N,) with float32 similarities.
    """
    q = np.ascontiguousarray(query_vec, dtype=np.float32).flatten()
    dim = len(q)
    if dim == 0:
        return np.array([], dtype=np.float32)

    db = np.ascontiguousarray(db_matrix, dtype=np.float32)
    if db.ndim != 2 or db.shape[1] != dim:
        return np.zeros((db.shape[0] if db.ndim >= 1 else 0,), dtype=np.float32)

    num_vecs = db.shape[0]
    if num_vecs == 0:
        return np.array([], dtype=np.float32)

    out = np.zeros(num_vecs, dtype=np.float32)

    if _RUST_AVAILABLE:
        ptr_q = q.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        ptr_db = db.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        ptr_out = out.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        res = _RUST_LIB.rust_batch_cosine_similarity(ptr_q, ptr_db, num_vecs, dim, ptr_out)
        if res == 1:
            return out

    # Fallback to NumPy
    q_norm = np.linalg.norm(q)
    if q_norm <= 1e-7:
        return out
    db_norms = np.linalg.norm(db, axis=1)
    denom = q_norm * np.maximum(db_norms, 1e-7)
    dots = np.dot(db, q)
    return (dots / denom).astype(np.float32)


def rust_nms(boxes, scores, iou_threshold=0.35):
    """
    High-performance Non-Maximum Suppression.
    boxes: list or array of [x, y, w, h]
    scores: list or array of detection confidence floats
    Returns: list of selected indices into `boxes`.
    """
    n = len(boxes)
    if n == 0:
        return []
    if n == 1:
        return [0]

    if _RUST_AVAILABLE:
        raw = np.zeros((n, 5), dtype=np.float32)
        for i in range(n):
            b = boxes[i]
            s = scores[i] if i < len(scores) else 0.5
            raw[i, 0] = float(b[0])
            raw[i, 1] = float(b[1])
            raw[i, 2] = float(b[2])
            raw[i, 3] = float(b[3])
            raw[i, 4] = float(s)

        keep_arr = np.zeros(n, dtype=np.int32)
        ptr_boxes = raw.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        ptr_keep = keep_arr.ctypes.data_as(ctypes.POINTER(ctypes.c_int32))

        kept_count = _RUST_LIB.rust_iou_nms(ptr_boxes, n, float(iou_threshold), ptr_keep)
        return keep_arr[:kept_count].tolist()

    # NumPy Fallback
    order = np.argsort(scores)[::-1]
    kept = []
    suppressed = np.zeros(n, dtype=bool)

    for i in range(n):
        idx = order[i]
        if suppressed[idx]:
            continue
        kept.append(int(idx))
        x1_a, y1_a, w_a, h_a = boxes[idx]
        x2_a = x1_a + w_a
        y2_a = y1_a + h_a
        area_a = max(0.0, w_a * h_a)

        for j in range(i + 1, n):
            idx_b = order[j]
            if suppressed[idx_b]:
                continue
            x1_b, y1_b, w_b, h_b = boxes[idx_b]
            x2_b = x1_b + w_b
            y2_b = y1_b + h_b
            area_b = max(0.0, w_b * h_b)

            inter_x1 = max(x1_a, x1_b)
            inter_y1 = max(y1_a, y1_b)
            inter_x2 = min(x2_a, x2_b)
            inter_y2 = min(y2_a, y2_b)

            if inter_x2 > inter_x1 and inter_y2 > inter_y1:
                inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
                union_area = area_a + area_b - inter_area
                iou = inter_area / union_area if union_area > 0 else 0.0
                if iou > iou_threshold:
                    suppressed[idx_b] = True

    return kept


def rust_sharpness(gray_img):
    """
    Fast Laplacian variance focus/sharpness score from 2D uint8 grayscale image.
    Higher values = sharper/clearer face.
    """
    if gray_img is None or gray_img.size == 0:
        return 0.0
    arr = np.ascontiguousarray(gray_img, dtype=np.uint8)
    h, w = arr.shape[:2]
    if h < 3 or w < 3:
        return 0.0

    if _RUST_AVAILABLE:
        ptr = arr.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        return float(_RUST_LIB.rust_laplacian_sharpness(ptr, w, h))

    # Fallback via cv2 or numpy
    try:
        import cv2
        return float(cv2.Laplacian(arr, cv2.CV_64F).var())
    except Exception:
        return float(np.var(arr))


def rust_otsu(gray_img):
    """Compute Otsu threshold on grayscale image via Rust."""
    if gray_img is None or gray_img.size == 0:
        return 128
    arr = np.ascontiguousarray(gray_img, dtype=np.uint8)
    h, w = arr.shape[:2]
    if _RUST_AVAILABLE:
        ptr = arr.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        return int(_RUST_LIB.rust_otsu_threshold(ptr, w, h))
    try:
        import cv2
        thresh, _ = cv2.threshold(arr, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return int(thresh)
    except Exception:
        return int(np.mean(arr))


def rust_contrast_enhance(gray_img):
    """Enhance grayscale document/card contrast via parallel Rust SIMD."""
    if gray_img is None or gray_img.size == 0:
        return gray_img
    arr = np.ascontiguousarray(gray_img, dtype=np.uint8)
    h, w = arr.shape[:2]
    out = np.zeros_like(arr)
    if _RUST_AVAILABLE:
        ptr_in = arr.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        ptr_out = out.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        ok = _RUST_LIB.rust_contrast_stretch(ptr_in, w, h, ptr_out)
        if ok == 1:
            return out

    # Fallback
    min_v, max_v = int(np.min(arr)), int(np.max(arr))
    if max_v - min_v < 5:
        return arr
    return np.clip(((arr.astype(np.float32) - min_v) / (max_v - min_v)) * 255.0, 0, 255).astype(np.uint8)


def rust_binarize(gray_img, method=0):
    """High-speed binarize for OCR via parallel Rust."""
    if gray_img is None or gray_img.size == 0:
        return gray_img
    arr = np.ascontiguousarray(gray_img, dtype=np.uint8)
    h, w = arr.shape[:2]
    out = np.zeros_like(arr)
    if _RUST_AVAILABLE:
        ptr_in = arr.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        ptr_out = out.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        ok = _RUST_LIB.rust_ocr_binarize(ptr_in, w, h, ptr_out, int(method))
        if ok == 1:
            return out

    # Fallback
    t = rust_otsu(arr)
    if method == 1:
        return np.where(arr > t, 0, 255).astype(np.uint8)
    return np.where(arr > t, 255, 0).astype(np.uint8)


def rust_levenshtein(s1, s2):
    """Compute Levenshtein edit distance via Rust."""
    if not s1:
        return len(s2) if s2 else 0
    if not s2:
        return len(s1)
    if _RUST_AVAILABLE:
        b1 = str(s1).encode('utf-8')
        b2 = str(s2).encode('utf-8')
        return int(_RUST_LIB.rust_levenshtein_distance(b1, b2))

    # Python fallback
    str1, str2 = str(s1).upper(), str(s2).upper()
    l1, l2 = len(str1), len(str2)
    dp = list(range(l2 + 1))
    for i, c1 in enumerate(str1):
        new_dp = [i + 1] * (l2 + 1)
        for j, c2 in enumerate(str2):
            cost = 0 if c1 == c2 else 1
            new_dp[j + 1] = min(new_dp[j] + 1, dp[j + 1] + 1, dp[j] + cost)
        dp = new_dp
    return dp[l2]


def rust_fuzzy_match(text, keyword):
    """Calculate fuzzy match similarity 0.0 to 1.0 between OCR token and target keyword."""
    if not text or not keyword:
        return 0.0
    if _RUST_AVAILABLE:
        b1 = str(text).encode('utf-8')
        b2 = str(keyword).encode('utf-8')
        return float(_RUST_LIB.rust_fuzzy_match_score(b1, b2))

    dist = rust_levenshtein(text, keyword)
    max_len = max(len(str(text)), len(str(keyword)))
    if max_len == 0:
        return 1.0
    return max(0.0, 1.0 - (dist / max_len))


def rust_handwriting_preprocess(gray_img, window_radius=18, k_factor=0.25):
    """
    Apply Sauvola Adaptive Binarization + morphological cursive gap bridging via Rust.
    Optimized for lifting handwritten / cursive ink off textured, lined, or noisy paper.
    """
    if gray_img is None or gray_img.size == 0:
        return gray_img
    arr = np.ascontiguousarray(gray_img, dtype=np.uint8)
    h, w = arr.shape[:2]
    if h < 3 or w < 3:
        return arr

    out_bin = np.zeros_like(arr)
    out_clean = np.zeros_like(arr)

    if _RUST_AVAILABLE:
        ptr_in = arr.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        ptr_bin = out_bin.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))
        ptr_clean = out_clean.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8))

        ok1 = _RUST_LIB.rust_handwriting_sauvola(ptr_in, w, h, ptr_bin, int(window_radius), float(k_factor))
        if ok1 == 1:
            ok2 = _RUST_LIB.rust_stroke_morph_clean(ptr_bin, w, h, ptr_clean)
            if ok2 == 1:
                return out_clean
            return out_bin

    # Fallback to OpenCV adaptive thresholding if Rust library not available
    try:
        import cv2
        thresh = cv2.adaptiveThreshold(
            arr, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 10
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        return cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    except Exception:
        return rust_binarize(arr)


def rust_match_profile_vectors(query_vec, vectors_matrix):
    """
    Match a query face embedding against multiple enrolled embeddings for a person profile.
    Returns (best_similarity, best_index).
    """
    q = np.ascontiguousarray(query_vec, dtype=np.float32).flatten()
    mat = np.ascontiguousarray(vectors_matrix, dtype=np.float32)
    if len(mat.shape) == 1:
        mat = mat.reshape(1, -1)
    num_vecs, dim = mat.shape
    if len(q) != dim or num_vecs == 0:
        return 0.0, 0

    if _RUST_AVAILABLE:
        ptr_q = q.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        ptr_mat = mat.ctypes.data_as(ctypes.POINTER(ctypes.c_float))
        out_sim = ctypes.c_float(0.0)
        out_idx = ctypes.c_size_t(0)
        ok = _RUST_LIB.rust_multi_vector_match(
            ptr_q, ptr_mat, num_vecs, dim,
            ctypes.byref(out_sim), ctypes.byref(out_idx)
        )
        if ok == 1:
            return float(out_sim.value), int(out_idx.value)

    # NumPy Fallback
    sims = []
    q_norm = np.linalg.norm(q)
    if q_norm < 1e-7:
        return 0.0, 0
    for i in range(num_vecs):
        v = mat[i]
        v_norm = np.linalg.norm(v)
        sim = float(np.dot(q, v) / (q_norm * v_norm)) if v_norm > 1e-7 else 0.0
        sims.append(sim)
    best_idx = int(np.argmax(sims))
    return float(sims[best_idx]), best_idx


