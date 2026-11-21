# 📡 FACED — OSINT FACIAL DATABASE
<p align="center">
  <img src="https://github.com/h9zdev/Faced/blob/main/Faced(1).png" alt="Faced" />
</p>

> [!NOTE]
> **FACED** — sFace Recognition & Identity Intelligence Platform.


A high-performance, standalone biometric face recognition and identity intelligence platform. Features deep neural network face detection, 128D facial feature embedding extraction, Facebook Research FAISS vector indexing, native multi-threaded Rust SIMD acceleration, document OCR parsing, and tactical cyberpunk-grade analytics.

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


## 📜 License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0) License. See the [LICENSE](LICENSE) file for more details.

**Unauthorized use is strictly prohibited.**

📧 Contact: singularat@protn.me


## ☕ Support

Donate via Monero: `45PU6txuLxtFFcVP95qT2xXdg7eZzPsqFfbtZp5HTjLbPquDAugBKNSh1bJ76qmAWNGMBCKk4R1UCYqXxYwYfP2wTggZNhq`



## 👥 Contributors and Developers

[<img src="https://avatars.githubusercontent.com/u/67865621?s=64&v=4" width="64" height="64" alt="haybnzz">](https://github.com/h9zdev)
[<img src="https://avatars.githubusercontent.com/u/108749445?s=64&v=4"  width="64" height="64" alt="VaradScript">](https://github.com/varadScript)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=h9zdev/Faced&type=timeline&legend=bottom-right)](https://www.star-history.com/#h9zdev/Faced&type=timeline&legend=bottom-right)
