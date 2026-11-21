# Contributing to FACED

Thank you for your interest in contributing to **FACED**! We welcome improvements, bug fixes, algorithmic optimizations, and documentation enhancements that expand the platform's biometric capabilities.

---

## 📜 Non-Commercial License Notice

Please note that **FACED** is licensed under the **PolyForm Noncommercial License 1.0.0**. By contributing to this repository, you agree that your contributions will be licensed under the same terms:
- All code is restricted to **Noncommercial Purposes** (research, education, personal projects, security testing).
- Commercial exploitation, resale, or embedding into paid enterprise software is strictly prohibited without explicit licensing from the author.

See [LICENSE.md](LICENSE.md) for complete details.

---

## 🛠️ Code of Conduct

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read and follow it to ensure a respectful and welcoming environment for all contributors.

---

## 🚀 How to Contribute

### 1. Reporting Bugs
- Check existing [GitHub Issues](https://github.com/h9zdev/Faced/issues) to ensure the bug hasn't already been reported.
- Open a new issue with a clear title and description.
- Include reproduction steps, environment details (OS, Python version, Rust version), and relevant terminal logs.

### 2. Proposing Features
- Open an Issue with the prefix `[Feature Request]: ...`.
- Explain the motivation, expected behavior, and technical feasibility (e.g., new ONNX model integration, SIMD optimizations, UI enhancements).

### 3. Submitting Pull Requests
1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Faced.git
   cd Faced
   ```
3. **Create a descriptive feature branch**:
   ```bash
   git checkout -b feature/improved-rust-simd
   ```
4. **Set up the development environment**:
   ```bash
   chmod +x setup.sh run.sh rust_engine/build.sh
   ./setup.sh
   ```
5. **Implement your changes** and test thoroughly.
6. **Commit with clear, conventional messages**:
   ```bash
   git commit -m "feat(rust_engine): optimize batch cosine similarity with AVX2 intrinsics"
   ```
7. **Push to your fork** and open a Pull Request against the `main` branch.

---

## 📐 Development Guidelines & Code Standards

### Python (`app.py`, `modules/`)
- Adhere to **PEP 8** style guidelines.
- Always use parameterized queries in SQLite (`modules/face_database.py`) to prevent SQL injection.
- Ensure all ctypes C-ABI bridge calls in `modules/face_bridge.py` explicitly declare `argtypes` and `restype`.
- Keep neural model inference isolated in `modules/face_service.py`.

### Rust Engine (`rust_engine/`)
- Ensure all code compiles cleanly on stable Rust:
  ```bash
  cd rust_engine
  cargo check
  cargo clippy
  cargo test
  ```
- Export all foreign functions with `#[no_mangle]` and `pub extern "C"`.
- Use `std::panic::catch_unwind` where appropriate to avoid unwinding across the C FFI boundary.

### Frontend (`templates/`, `static/`)
- Maintain the dark tactical cyberpunk visual aesthetic (`tactical-index.css`).
- Use vanilla JavaScript without heavy external frontend framework dependencies to keep the bundle lightweight and air-gapped.
- Ensure all dynamically rendered user content is escaped or sanitised to prevent XSS.

---

## 🧪 Testing Checklist

Before opening a PR, ensure:
- [ ] Server starts cleanly with `./run.sh` on port 8005.
- [ ] `/api/health` returns `status: healthy` and `rust_simd_accelerated: true`.
- [ ] Both YuNet face detection and SFace 128D embedding extraction pass without warnings.
- [ ] FAISS vector indexing and SQLite profile persistence function properly.
- [ ] UI centered upload dropzone transitions seamlessly to the results workspace.
