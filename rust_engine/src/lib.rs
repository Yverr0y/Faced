use rayon::prelude::*;
use std::slice;

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub score: f32,
}

#[no_mangle]
pub extern "C" fn rust_face_engine_version() -> i32 {
    200
}

/// Calculate cosine similarity between two float vectors
#[no_mangle]
pub extern "C" fn rust_cosine_similarity(a: *const f32, b: *const f32, len: usize) -> f32 {
    if a.is_null() || b.is_null() || len == 0 {
        return 0.0;
    }
    let s_a = unsafe { slice::from_raw_parts(a, len) };
    let s_b = unsafe { slice::from_raw_parts(b, len) };

    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for i in 0..len {
        dot += s_a[i] * s_b[i];
        norm_a += s_a[i] * s_a[i];
        norm_b += s_b[i] * s_b[i];
    }

    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom > 1e-7 {
        dot / denom
    } else {
        0.0
    }
}

/// Calculate Euclidean (L2) distance between two float vectors
#[no_mangle]
pub extern "C" fn rust_l2_distance(a: *const f32, b: *const f32, len: usize) -> f32 {
    if a.is_null() || b.is_null() || len == 0 {
        return 0.0;
    }
    let s_a = unsafe { slice::from_raw_parts(a, len) };
    let s_b = unsafe { slice::from_raw_parts(b, len) };

    let mut sum_sq = 0.0f32;
    for i in 0..len {
        let diff = s_a[i] - s_b[i];
        sum_sq += diff * diff;
    }
    sum_sq.sqrt()
}

/// Batch compute cosine similarities across `num_vectors` stored consecutively in `db_matrix`.
/// Uses Rayon parallel worker pool to execute at multi-core CPU speed.
#[no_mangle]
pub extern "C" fn rust_batch_cosine_similarity(
    query: *const f32,
    db_matrix: *const f32,
    num_vectors: usize,
    dim: usize,
    out_similarities: *mut f32,
) -> i32 {
    if query.is_null() || db_matrix.is_null() || out_similarities.is_null() || num_vectors == 0 || dim == 0 {
        return 0;
    }

    let q_slice = unsafe { slice::from_raw_parts(query, dim) };
    let total_elements = num_vectors * dim;
    let db_slice = unsafe { slice::from_raw_parts(db_matrix, total_elements) };
    let out_slice = unsafe { slice::from_raw_parts_mut(out_similarities, num_vectors) };

    // Query norm
    let mut q_norm_sq = 0.0f32;
    for &val in q_slice {
        q_norm_sq += val * val;
    }
    let q_norm = q_norm_sq.sqrt();
    if q_norm <= 1e-7 {
        for item in out_slice.iter_mut() {
            *item = 0.0;
        }
        return 1;
    }

    // Parallel chunks over DB vectors
    out_slice
        .par_iter_mut()
        .enumerate()
        .for_each(|(idx, out_val)| {
            let offset = idx * dim;
            let vec = &db_slice[offset..offset + dim];
            let mut dot = 0.0f32;
            let mut v_norm_sq = 0.0f32;
            for i in 0..dim {
                dot += q_slice[i] * vec[i];
                v_norm_sq += vec[i] * vec[i];
            }
            let denom = q_norm * v_norm_sq.sqrt();
            *out_val = if denom > 1e-7 { dot / denom } else { 0.0 };
        });

    1
}

/// High-speed Non-Maximum Suppression (NMS) over 5-float bounding boxes: [x, y, w, h, score]
/// Returns number of kept boxes. Keep indices written to `keep_out`.
#[no_mangle]
pub extern "C" fn rust_iou_nms(
    boxes_in: *const f32,
    num_boxes: usize,
    iou_threshold: f32,
    keep_out: *mut i32,
) -> usize {
    if boxes_in.is_null() || keep_out.is_null() || num_boxes == 0 {
        return 0;
    }

    let raw = unsafe { slice::from_raw_parts(boxes_in, num_boxes * 5) };
    let mut boxes: Vec<(usize, BoundingBox)> = (0..num_boxes)
        .map(|i| {
            let base = i * 5;
            (
                i,
                BoundingBox {
                    x: raw[base],
                    y: raw[base + 1],
                    width: raw[base + 2],
                    height: raw[base + 3],
                    score: raw[base + 4],
                },
            )
        })
        .collect();

    // Sort by score descending
    boxes.sort_by(|a, b| b.1.score.partial_cmp(&a.1.score).unwrap_or(std::cmp::Ordering::Equal));

    let mut kept_indices = Vec::with_capacity(num_boxes);
    let mut suppressed = vec![false; num_boxes];

    for i in 0..num_boxes {
        if suppressed[i] {
            continue;
        }
        let (orig_idx, box_a) = boxes[i];
        kept_indices.push(orig_idx as i32);

        let area_a = (box_a.width * box_a.height).max(0.0);

        for j in (i + 1)..num_boxes {
            if suppressed[j] {
                continue;
            }
            let (_, box_b) = boxes[j];

            let x1 = box_a.x.max(box_b.x);
            let y1 = box_a.y.max(box_b.y);
            let x2 = (box_a.x + box_a.width).min(box_b.x + box_b.width);
            let y2 = (box_a.y + box_a.height).min(box_b.y + box_b.height);

            let inter_w = (x2 - x1).max(0.0);
            let inter_h = (y2 - y1).max(0.0);
            let inter_area = inter_w * inter_h;

            let area_b = (box_b.width * box_b.height).max(0.0);
            let union_area = area_a + area_b - inter_area;

            let iou = if union_area > 0.0 { inter_area / union_area } else { 0.0 };
            if iou > iou_threshold {
                suppressed[j] = true;
            }
        }
    }

    let kept_len = kept_indices.len();
    unsafe {
        let dest = slice::from_raw_parts_mut(keep_out, kept_len);
        dest.copy_from_slice(&kept_indices);
    }

    kept_len
}

/// Fast Laplacian variance calculation for image focus/sharpness
/// Returns variance of Laplacian kernel response across grayscale pixels
#[no_mangle]
pub extern "C" fn rust_laplacian_sharpness(
    gray_pixels: *const u8,
    width: usize,
    height: usize,
) -> f32 {
    if gray_pixels.is_null() || width < 3 || height < 3 {
        return 0.0;
    }

    let img = unsafe { slice::from_raw_parts(gray_pixels, width * height) };

    // Compute Laplacian responses
    let stride = width;
    let mut sum: f64 = 0.0;
    let mut sum_sq: f64 = 0.0;
    let mut count: usize = 0;

    for y in 1..(height - 1) {
        let row_curr = y * stride;
        let row_prev = (y - 1) * stride;
        let row_next = (y + 1) * stride;

        for x in 1..(width - 1) {
            let center = img[row_curr + x] as i32;
            let top = img[row_prev + x] as i32;
            let bottom = img[row_next + x] as i32;
            let left = img[row_curr + x - 1] as i32;
            let right = img[row_curr + x + 1] as i32;

            // 3x3 Laplacian: 4*center - (top + bottom + left + right)
            let lap = (4 * center - top - bottom - left - right) as f64;
            sum += lap;
            sum_sq += lap * lap;
            count += 1;
        }
    }

    if count == 0 {
        return 0.0;
    }

    let mean = sum / count as f64;
    let variance = (sum_sq / count as f64) - (mean * mean);
    variance.max(0.0) as f32
}

/// Compute Otsu's optimal threshold for grayscale image
#[no_mangle]
pub extern "C" fn rust_otsu_threshold(gray_pixels: *const u8, width: usize, height: usize) -> u8 {
    if gray_pixels.is_null() || width == 0 || height == 0 {
        return 128;
    }
    let total_pixels = width * height;
    let img = unsafe { slice::from_raw_parts(gray_pixels, total_pixels) };

    let mut hist = [0u32; 256];
    for &p in img {
        hist[p as usize] += 1;
    }

    let total = total_pixels as f64;
    let mut sum = 0.0f64;
    for (i, &count) in hist.iter().enumerate() {
        sum += (i as f64) * (count as f64);
    }

    let mut sum_b = 0.0f64;
    let mut w_b = 0.0f64;
    let mut max_var = 0.0f64;
    let mut threshold = 128u8;

    for (t, &count) in hist.iter().enumerate() {
        w_b += count as f64;
        if w_b == 0.0 {
            continue;
        }
        let w_f = total - w_b;
        if w_f == 0.0 {
            break;
        }

        sum_b += (t as f64) * (count as f64);
        let m_b = sum_b / w_b;
        let m_f = (sum - sum_b) / w_f;

        let between_var = w_b * w_f * (m_b - m_f) * (m_b - m_f);
        if between_var > max_var {
            max_var = between_var;
            threshold = t as u8;
        }
    }

    threshold
}

/// High-speed parallel contrast stretch for OCR clarity
#[no_mangle]
pub extern "C" fn rust_contrast_stretch(
    gray_in: *const u8,
    width: usize,
    height: usize,
    out_enhanced: *mut u8,
) -> i32 {
    if gray_in.is_null() || out_enhanced.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let total = width * height;
    let src = unsafe { slice::from_raw_parts(gray_in, total) };
    let dst = unsafe { slice::from_raw_parts_mut(out_enhanced, total) };

    // Find min and max
    let mut min_val = 255u8;
    let mut max_val = 0u8;
    for &p in src {
        if p < min_val {
            min_val = p;
        }
        if p > max_val {
            max_val = p;
        }
    }

    let diff = (max_val as f32) - (min_val as f32);
    if diff < 5.0 {
        dst.copy_from_slice(src);
        return 1;
    }

    // Parallel stretch
    dst.par_iter_mut()
        .zip(src.par_iter())
        .for_each(|(out_p, &in_p)| {
            let norm = ((in_p as f32 - min_val as f32) / diff) * 255.0;
            *out_p = norm.clamp(0.0, 255.0) as u8;
        });

    1
}

/// High-speed parallel binarization for document/ID card OCR
/// method 0: Otsu global thresholding
/// method 1: Contrast stretch + inverted Otsu (if dark background)
#[no_mangle]
pub extern "C" fn rust_ocr_binarize(
    gray_in: *const u8,
    width: usize,
    height: usize,
    out_bin: *mut u8,
    method: i32,
) -> i32 {
    if gray_in.is_null() || out_bin.is_null() || width == 0 || height == 0 {
        return 0;
    }
    let total = width * height;
    let src = unsafe { slice::from_raw_parts(gray_in, total) };
    let dst = unsafe { slice::from_raw_parts_mut(out_bin, total) };

    let threshold = rust_otsu_threshold(gray_in, width, height);

    dst.par_iter_mut()
        .zip(src.par_iter())
        .for_each(|(out_p, &in_p)| {
            if method == 1 {
                // Inverted
                *out_p = if in_p > threshold { 0 } else { 255 };
            } else {
                *out_p = if in_p > threshold { 255 } else { 0 };
            }
        });

    1
}

/// Levenshtein edit distance between two UTF-8 C strings (for fuzzy matching OCR labels)
#[no_mangle]
pub extern "C" fn rust_levenshtein_distance(
    s1: *const std::os::raw::c_char,
    s2: *const std::os::raw::c_char,
) -> usize {
    if s1.is_null() || s2.is_null() {
        return usize::MAX;
    }
    let str1 = unsafe { std::ffi::CStr::from_ptr(s1).to_string_lossy() };
    let str2 = unsafe { std::ffi::CStr::from_ptr(s2).to_string_lossy() };

    let c1: Vec<char> = str1.chars().collect();
    let c2: Vec<char> = str2.chars().collect();

    let len1 = c1.len();
    let len2 = c2.len();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }

    let mut prev_row: Vec<usize> = (0..=len2).collect();
    let mut curr_row: Vec<usize> = vec![0; len2 + 1];

    for i in 0..len1 {
        curr_row[0] = i + 1;
        for j in 0..len2 {
            let cost = if c1[i].to_ascii_uppercase() == c2[j].to_ascii_uppercase() { 0 } else { 1 };
            curr_row[j + 1] = (curr_row[j] + 1)
                .min(prev_row[j + 1] + 1)
                .min(prev_row[j] + cost);
        }
        prev_row.copy_from_slice(&curr_row);
    }

    curr_row[len2]
}

/// Fuzzy match score (0.0 to 1.0) between OCR token and target label keyword
#[no_mangle]
pub extern "C" fn rust_fuzzy_match_score(
    text: *const std::os::raw::c_char,
    keyword: *const std::os::raw::c_char,
) -> f32 {
    let dist = rust_levenshtein_distance(text, keyword);
    if dist == usize::MAX {
        return 0.0;
    }
    let text_len = unsafe {
        if text.is_null() { 0 } else { std::ffi::CStr::from_ptr(text).to_bytes().len() }
    };
    let kw_len = unsafe {
        if keyword.is_null() { 0 } else { std::ffi::CStr::from_ptr(keyword).to_bytes().len() }
    };
    let max_len = text_len.max(kw_len);
    if max_len == 0 {
        return 1.0;
    }
    let sim = 1.0 - (dist as f32 / max_len as f32);
    sim.max(0.0)
}

/// Advanced Sauvola Adaptive Binarization for Handwriting & Cursive Script
/// Uses integral images for O(1) area window evaluation with Rayon multi-threading.
#[no_mangle]
pub extern "C" fn rust_handwriting_sauvola(
    gray_in: *const u8,
    width: usize,
    height: usize,
    out_bin: *mut u8,
    window_radius: usize,
    k_factor: f32,
) -> i32 {
    if gray_in.is_null() || out_bin.is_null() || width < 3 || height < 3 {
        return 0;
    }

    let r = if window_radius < 3 { 15 } else { window_radius };
    let k = if k_factor <= 0.0 { 0.25f64 } else { k_factor as f64 };
    let r_dyn = 128.0f64;

    let total = width * height;
    let img = unsafe { slice::from_raw_parts(gray_in, total) };
    let dst = unsafe { slice::from_raw_parts_mut(out_bin, total) };

    let stride_i = width + 1;
    let mut int_sum: Vec<f64> = vec![0.0; stride_i * (height + 1)];
    let mut int_sq: Vec<f64> = vec![0.0; stride_i * (height + 1)];

    // Compute 2D Integral Images
    for y in 0..height {
        let mut row_sum = 0.0f64;
        let mut row_sq = 0.0f64;
        let src_row = y * width;
        let dst_prev_row = y * stride_i;
        let dst_curr_row = (y + 1) * stride_i;

        for x in 0..width {
            let p = img[src_row + x] as f64;
            row_sum += p;
            row_sq += p * p;

            int_sum[dst_curr_row + x + 1] = int_sum[dst_prev_row + x + 1] + row_sum;
            int_sq[dst_curr_row + x + 1] = int_sq[dst_prev_row + x + 1] + row_sq;
        }
    }

    // Parallel row evaluation
    dst.par_chunks_mut(width)
        .enumerate()
        .for_each(|(y, row_out)| {
            let y1 = if y >= r { y - r } else { 0 };
            let y2 = (y + r).min(height - 1);

            let row_p1 = y1 * stride_i;
            let row_p2 = (y2 + 1) * stride_i;
            let src_row_base = y * width;

            for x in 0..width {
                let x1 = if x >= r { x - r } else { 0 };
                let x2 = (x + r).min(width - 1);

                let area = ((x2 - x1 + 1) * (y2 - y1 + 1)) as f64;

                let sum = int_sum[row_p2 + x2 + 1]
                    - int_sum[row_p1 + x2 + 1]
                    - int_sum[row_p2 + x1]
                    + int_sum[row_p1 + x1];

                let sum_sq = int_sq[row_p2 + x2 + 1]
                    - int_sq[row_p1 + x2 + 1]
                    - int_sq[row_p2 + x1]
                    + int_sq[row_p1 + x1];

                let mean = sum / area;
                let var = (sum_sq / area) - (mean * mean);
                let std = var.max(0.0).sqrt();

                let threshold = mean * (1.0 + k * (std / r_dyn - 1.0));
                let p = img[src_row_base + x] as f64;

                // Handwriting text: dark ink on light background -> 0 is ink, 255 is background
                row_out[x] = if p <= threshold { 0 } else { 255 };
            }
        });

    1
}

/// Fast morphological cursive stroke connector & noise cleaner
#[no_mangle]
pub extern "C" fn rust_stroke_morph_clean(
    bin_in: *const u8,
    width: usize,
    height: usize,
    out_cleaned: *mut u8,
) -> i32 {
    if bin_in.is_null() || out_cleaned.is_null() || width < 3 || height < 3 {
        return 0;
    }
    let total = width * height;
    let src = unsafe { slice::from_raw_parts(bin_in, total) };
    let dst = unsafe { slice::from_raw_parts_mut(out_cleaned, total) };

    // Copy borders
    for x in 0..width {
        dst[x] = src[x];
        dst[(height - 1) * width + x] = src[(height - 1) * width + x];
    }

    dst.par_chunks_mut(width)
        .enumerate()
        .for_each(|(y, row_out)| {
            if y == 0 || y == height - 1 {
                return;
            }
            let row_c = y * width;
            let row_p = (y - 1) * width;
            let row_n = (y + 1) * width;

            for x in 1..(width - 1) {
                let p = src[row_c + x];
                if p == 0 {
                    // Ink pixel: keep
                    row_out[x] = 0;
                } else {
                    // Check if flanked horizontally or vertically by ink (connect cursive gaps)
                    let h_neighbors = (src[row_c + x - 1] == 0) && (src[row_c + x + 1] == 0);
                    let v_neighbors = (src[row_p + x] == 0) && (src[row_n + x] == 0);
                    if h_neighbors || v_neighbors {
                        row_out[x] = 0; // bridge connection
                    } else {
                        row_out[x] = 255;
                    }
                }
            }
        });

    1
}

/// Compute max cosine similarity against multiple vectors for the same profile
#[no_mangle]
pub extern "C" fn rust_multi_vector_match(
    query: *const f32,
    vectors_matrix: *const f32,
    num_vectors: usize,
    dim: usize,
    out_max_sim: *mut f32,
    out_best_idx: *mut usize,
) -> i32 {
    if query.is_null() || vectors_matrix.is_null() || out_max_sim.is_null() || num_vectors == 0 || dim == 0 {
        return 0;
    }

    let q = unsafe { slice::from_raw_parts(query, dim) };
    let total = num_vectors * dim;
    let mat = unsafe { slice::from_raw_parts(vectors_matrix, total) };

    let mut q_norm_sq = 0.0f32;
    for &val in q {
        q_norm_sq += val * val;
    }
    let q_norm = q_norm_sq.sqrt();
    if q_norm <= 1e-7 {
        unsafe {
            *out_max_sim = 0.0;
            if !out_best_idx.is_null() {
                *out_best_idx = 0;
            }
        }
        return 1;
    }

    let mut max_sim = -1.0f32;
    let mut best_idx = 0usize;

    for i in 0..num_vectors {
        let offset = i * dim;
        let v = &mat[offset..offset + dim];
        let mut dot = 0.0f32;
        let mut v_norm_sq = 0.0f32;
        for d in 0..dim {
            dot += q[d] * v[d];
            v_norm_sq += v[d] * v[d];
        }
        let denom = q_norm * v_norm_sq.sqrt();
        let sim = if denom > 1e-7 { dot / denom } else { 0.0 };
        if sim > max_sim {
            max_sim = sim;
            best_idx = i;
        }
    }

    unsafe {
        *out_max_sim = max_sim.max(0.0);
        if !out_best_idx.is_null() {
            *out_best_idx = best_idx;
        }
    }

    1
}


