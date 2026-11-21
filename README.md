# FACED — Face Recognition & Identity Intelligence Platform

A high-performance, standalone biometric face recognition and identity intelligence platform extracted from **HayOS**. Features deep neural network face detection, 128D facial feature embedding extraction, Facebook Research FAISS vector indexing, native multi-threaded Rust SIMD acceleration, document OCR parsing, and tactical cyberpunk-grade analytics.

---

## ⚡ Core Architecture

```
[ Uploaded Image / PDF / Camera Stream ]
                   │
                   ▼
     ┌───────────────────────────┐
     │  OpenCV YuNet ONNX Model   │ ──► Multi-face detection, bounding boxes,
     │    (Deep Face Detector)    │     5-point facial landmarks, confidence scores
     └─────────────┬─────────────┘
                   ▼
     ┌───────────────────────────┐
     │  OpenCV SFace ONNX Model  │ ──► 128-dimensional biometric feature embeddings
     │  (128D Deep Feature Net)  │     (L2-normalized unit sphere vectors)
     └─────────────┬─────────────┘
                   ▼
     ┌───────────────────────────┐
     │  Rust SIMD Rayon Engine   │ ──► Multi-threaded parallel batch cosine similarity,
     │     (libfaced_rs.so)      │     IoU Non-Maximum Suppression (NMS), Laplacian sharpness
     └─────────────┬─────────────┘
                   ▼
     ┌───────────────────────────┐
     │   Facebook FAISS Index    │ ──► Sub-millisecond exact Inner-Product / Cosine
     │       (IndexFlatIP)       │     similarity search across thousands of face vectors
     └─────────────┬─────────────┘
                   ▼
     ┌───────────────────────────┐
     │  SQLite Biometric Vault   │ ──► Full biographical dossiers: Name, DOB, Address,
     │    (face_database.db)     │     ID Number, Blood Group, Phone, Relatives, Notes
     └───────────────────────────┘
```

---

## 📁 Project Structure

```
/home/h9871/faced/
├── app.py                     # Standalone Flask server with complete REST APIs & Web UI
├── requirements.txt           # Python 3 dependencies (OpenCV, FAISS, Pillow, NumPy, etc.)
├── setup.sh                   # One-step automated installation & verification script
├── run.sh                     # Launch script (starts FACED on port 8005)
├── README.md                  # Complete documentation (this file)
│
├── modules/                   # Backend Python processing engines
│   ├── __init__.py
│   ├── face_bridge.py         # C-ABI ctypes bridge to native Rust shared library
│   ├── face_database.py       # FAISS 128D vector index + SQLite database manager
│   ├── face_service.py        # YuNet detector & SFace embedder neural pipeline
│   ├── ocr_service.py         # Document & ID card OCR extraction pipeline
│   ├── pdf_service.py         # Multi-page PDF renderer & rasterizer
│   └── libfaced_rs.so         # Precompiled native Rust multi-threaded acceleration library
│
├── rust_engine/               # High-performance native Rust source
│   ├── Cargo.toml             # Rust package definition (cdylib, rlib, Rayon, Libc)
│   ├── build.sh               # Rust build & release compilation script
│   └── src/
│       └── lib.rs             # Rayon parallel SIMD cosine distance, NMS & filters
│
├── data/                      # Persistent biometric data & neural models
│   ├── face_database.db       # SQLite biometric database (42 enrolled identities)
│   ├── face_vectors.faiss     # FAISS vector store (85 registered face embeddings)
│   └── face_models/           # Deep learning ONNX model weights
│       ├── face_detection_yunet_2023mar.onnx    # YuNet face detector
│       └── face_recognition_sface_2021dec.onnx  # SFace 128D embedder
│
├── static/                    # Frontend styling & JavaScript controller
│   ├── css/
│   │   └── tactical-index.css # HayOS dark tactical/cyberpunk theme
│   └── js/
│       └── face_intelligence.js # Interactive canvas, landmarks & database controller
│
└── templates/
    └── index.html             # Standalone full-screen dashboard matching HayOS UI
```

---

## 🛠️ Installation & Setup

### Prerequisites
* **Linux (x86_64 or aarch64)**
* **Python 3.10+** (Python 3.14 compatible)
* **Rust & Cargo** (for compiling native acceleration library)

### 1. Automatic One-Step Setup
Run the included setup script to compile the Rust library, verify Python dependencies, and check neural models:
```bash
cd /home/h9871/faced
chmod +x setup.sh run.sh rust_engine/build.sh
./setup.sh
```

### 2. Manual Step-by-Step Setup

#### A. Rust Native Engine Setup
If you need to recompile the native Rust shared library:
```bash
cd /home/h9871/faced/rust_engine
cargo build --release
cp target/release/libfaced_rs.so ../modules/libfaced_rs.so
```

#### B. Python Environment Setup
Install the required Python packages:
```bash
cd /home/h9871/faced
pip install -r requirements.txt
```

---

## 🚀 Running the Platform

To start the standalone web server:
```bash
cd /home/h9871/faced
./run.sh
```
Or directly with Python on a custom port:
```bash
PORT=8005 python3 app.py
```

Once started, navigate in your web browser to:
👉 **`http://127.0.0.1:8005`**

---

## 🖥️ Web User Interface Features

The user interface matches the dark tactical cyberpunk theme of HayOS and features a streamlined centered workflow:

### 1. Centered Hero Photo Upload & Biometric Scanner (`1. BIOMETRIC SCANNER`)
* **Centered Scanner Dropzone**:
  * Clean, focused cybernetic aperture upload dropzone centered on the screen upon launch.
  * Drag and drop portrait images, photos, ID cards, or PDF documents.
  * Direct file browser button or clipboard paste (**Ctrl+V** / **PASTE FROM CLIPBOARD**).
* **Automatic Workspace Transition**:
  * Once a photo is dropped, selected, or pasted, the centered dropzone smoothly disappears.
  * The full split-grid analysis workspace appears instantly with real-time detection and 128D embeddings.
  * Quick-action **"SEARCH ANOTHER PHOTO"** and **"CLEAR"** buttons instantly restore the centered dropzone.
* **Real-Time Visual Canvas Overlays**:
  * Draws bounding boxes around all detected faces with confidence ratings.
  * Renders 5-point facial landmarks (right eye, left eye, nose tip, right mouth corner, left mouth corner).
* **Biometric Inspection & Vector Matching**:
  * Extracts 128-dimensional embedding vectors with SHA-256 fingerprints.
  * Instant vector search against enrolled identities with percentage match confidence.
  * **Save to Face Database**: Enroll detected faces with full metadata into SQLite & FAISS.
* **Document & EXIF Intelligence**:
  * Technical camera metadata (Camera Make, Model, Shutter, ISO, GPS coordinates).
  * Direct visual reverse search uplink (Google Lens, Bing Visual Search, Yandex AI, TinEye).

### 2. Header & Tactical Footer
* **Top Header Navbar**: Cybernetic aperture logo, brand identity, live engine status pill (`RUST SIMD + FAISS READY`), and one-click mode switcher tabs.
* **Tactical Footer Telemetry**: Live indicators for multithreaded Rust Rayon SIMD acceleration, FAISS vector count (85 vectors across 42 identities), 128D L2 normalization, and API endpoint readiness.

### 2. Face Database & FAISS Manager (`2. FACE DATABASE & FAISS`)
* **Biometric Search by Photo**: Drop any photo or PDF into the database view to find matching enrolled profiles in sub-milliseconds.
* **Identity Dossier Modal**: Click any identity card to open the complete dossier showing biographical details, all linked portrait photos, and document text.
* **Profile Editor**: Edit names, DOB, document numbers, addresses, blood groups, contact phones, emails, and notes.
* **Profile Merger**: Merge duplicate identities into a unified profile while retaining all linked 128D vectors.
* **Delete & Re-Index**: Remove records with automatic, zero-downtime FAISS index rebuilding.

---

## 📡 REST API Reference

### 1. Face Recognition Scan
* **Endpoint**: `POST /api/face/recognition`
* **Content-Type**: `multipart/form-data` or `image/jpeg`
* **Parameters**:
  * `image`: Binary image file (JPEG, PNG, WEBP, or PDF)
* **Example**:
  ```bash
  curl -X POST -F "image=@photo.jpg" http://127.0.0.1:8005/api/face/recognition
  ```
* **Response**:
  ```json
  {
    "status": "success",
    "analysis": {
      "faceCount": 1,
      "faces": [
        {
          "faceIndex": 1,
          "box": [120, 80, 210, 210],
          "confidence": 0.985,
          "landmarks": [[160, 140], [220, 138], [190, 180], [165, 220], [215, 218]],
          "embedding": [0.042, -0.118, ...],
          "matchedIdentity": {
            "id": 1,
            "name": "Jane Doe",
            "matchPct": 94.2,
            "cosineSimilarity": 0.942
          }
        }
      ]
    }
  }
  ```

### 2. Enroll New Face
* **Endpoint**: `POST /api/face/database/add`
* **Content-Type**: `application/json`
* **Payload**:
  ```json
  {
    "name": "Jane Doe",
    "embedding": [0.042, -0.118, ...],
    "thumbnail": "data:image/jpeg;base64,...",
    "dob": "1992-05-14",
    "id_number": "ID-8849201",
    "document_type": "Passport",
    "address": "404 Cyber St, Neo City",
    "blood_group": "O+",
    "phone": "+1-555-0199",
    "email": "jane.doe@intel.local",
    "notes": "Verified operative identity"
  }
  ```

### 3. Search Database by Photo
* **Endpoint**: `POST /api/face/database/search_image`
* **Content-Type**: `multipart/form-data`
* **Parameters**:
  * `image`: Query image file

### 4. List Enrolled Faces
* **Endpoint**: `GET /api/face/database/list?limit=100&q=jane`
* **Response**: List of enrolled profiles with thumbnails, photo counts, and statistics.

### 5. System Health & Hardware Telemetry
* **Endpoint**: `GET /api/health`
* **Response**:
  ```json
  {
    "status": "healthy",
    "platform": "FACED Intelligence Engine",
    "rust_simd_accelerated": true,
    "faiss_vector_index": true,
    "total_enrolled_faces": 42,
    "total_indexed_vectors": 85,
    "vector_dimension": 128
  }
  ```

---

## 🗄️ Database Schema

### `face_records` Table
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Identity ID |
| `name` | TEXT | Enrolled individual's name |
| `thumbnail` | TEXT | Base64 cropped face thumbnail |
| `embedding_json` | TEXT | Primary 128D vector JSON array |
| `embedding_hash` | TEXT | SHA-256 vector hash |
| `dob` | TEXT | Date of birth |
| `id_number` | TEXT | National ID / Passport number |
| `document_type` | TEXT | ID document classification |
| `address` | TEXT | Residential or official address |
| `blood_group` | TEXT | Blood type |
| `phone` | TEXT | Contact number |
| `email` | TEXT | Contact email |
| `photo_count` | INTEGER | Number of linked face embeddings |
| `notes` | TEXT | Freeform intelligence notes |

### `face_profile_embeddings` Table
Stores multiple biometric variations per individual (different angles, lighting, age progression):
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Vector ID |
| `profile_id` | INTEGER (FK) | Reference to `face_records(id)` |
| `thumbnail` | TEXT | Photo thumbnail for this variation |
| `embedding_json` | TEXT | 128D embedding vector |
| `embedding_hash` | TEXT | SHA-256 hash |
| `quality_score` | REAL | Image sharpness score |
| `created_at` | TIMESTAMP | Enrollment timestamp |

---

## ⚡ Rust Native C-ABI Functions (`libfaced_rs.so`)

The Rust engine exposes multi-threaded C ABI functions callable via Python `ctypes`:
* `rust_face_engine_version() -> i32`
* `rust_cosine_similarity(v1: *const f32, v2: *const f32, len: usize) -> f32`
* `rust_l2_distance(v1: *const f32, v2: *const f32, len: usize) -> f32`
* `rust_batch_cosine_similarity(query, database, dim, n, results) -> i32`
* `rust_iou_nms(boxes, n, threshold, indices) -> usize`
* `rust_laplacian_sharpness(img_gray, width, height) -> f32`
* `rust_contrast_stretch(src, width, height, dst) -> i32`
* `rust_levenshtein_distance(s1: *const c_char, s2: *const c_char) -> usize`
* `rust_fuzzy_match_score(s1: *const c_char, s2: *const c_char) -> f32`

---

## 📜 License
Internal Tactical Intelligence Suite — Engineered for high-speed local biometric operations.
