

# Contributing to Faced

Thanks for your interest in contributing to Faced. This guide covers how to set up the project, what we expect from contributions, and how to submit changes.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to Contribute

- Report bugs and suggest features through [GitHub Issues](https://github.com/h9zdev/Faced/issues).
- Improve documentation.
- Fix bugs or add features through pull requests.
- Improve performance in the Python pipeline or the Rust engine.
- Report security or privacy issues responsibly (see below).

## Responsible Use Requirements

Faced handles facial detection, biometric embeddings, and identity data. These rules apply to every contribution:

- **Never commit real biometric data.** This includes real face photos, embeddings, thumbnails, and personal records.
- **Use dummy data only.** Use `seed_dummy_database.py` to generate test data.
- **Do not commit** `data/face_database.db`, `data/face_vectors.faiss`, or any file containing real identities, ID numbers, addresses, phone numbers, or emails.
- **Do not add features** designed for unauthorized surveillance, stalking, harassment, or covert identification.
- **Do not present match scores as definitive proof of identity.** Keep UI text and docs clear that similarity is probabilistic.
- **Never commit** credentials, API keys, or private datasets.

Contributions that violate these rules will be rejected.

## Getting Started

### Prerequisites

- Linux (x86_64 or aarch64)
- Python 3.10+
- Rust and Cargo (to build the native acceleration library)

### Setup

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/Faced.git
   cd Faced
   ```

2. Run the setup script:

   ```bash
   chmod +x setup.sh run.sh rust_engine/build.sh
   ./setup.sh
   ```

   Or set up manually:

   ```bash
   # Rust engine
   cd rust_engine
   cargo build --release
   cp target/release/libfaced_rs.so ../modules/libfaced_rs.so
   cd ..

   # Python dependencies
   pip install -r requirements.txt
   ```

3. Seed a dummy database for testing:

   ```bash
   python3 seed_dummy_database.py
   ```

4. Start the app:

   ```bash
   ./run.sh
   ```

   Or on a custom port:

   ```bash
   PORT=8005 python3 app.py
   ```

   Then open `http://127.0.0.1:8005`.

## Project Structure

| Path | Purpose |
| --- | --- |
| `app.py` | Flask server, REST APIs, and web UI routes |
| `modules/face_service.py` | YuNet detector and SFace embedder pipeline |
| `modules/face_database.py` | FAISS index and SQLite database manager |
| `modules/face_bridge.py` | ctypes bridge to the Rust library |
| `modules/ocr_service.py` | Document and ID card OCR |
| `modules/pdf_service.py` | PDF rendering |
| `rust_engine/` | Native Rust source (similarity, NMS, filters) |
| `static/` | CSS and JavaScript frontend |
| `templates/` | HTML templates |
| `data/` | Models and local databases (do not commit real data) |

## Making Changes

1. Create a branch from `main`:

   ```bash
   git checkout -b feature/short-description
   ```

   Suggested prefixes: `feature/`, `fix/`, `docs/`, `refactor/`, `perf/`.

2. Make your changes in small, focused commits.
3. Test your changes locally (see below).
4. Push to your fork and open a pull request against `main`.

## Coding Guidelines

### Python

- Follow PEP 8.
- Use clear function and variable names.
- Add docstrings to new functions and modules.
- Handle errors explicitly and return meaningful API error responses.
- Keep API response formats consistent with the existing endpoints.

### Rust

- Run `cargo fmt` and `cargo clippy` before submitting.
- Keep the C-ABI functions stable. If you change a signature, update `modules/face_bridge.py` and the README in the same PR.
- Document any `unsafe` blocks.

### Frontend

- Keep the existing tactical dark theme and styling conventions.
- Avoid adding heavy dependencies without discussion.

## Testing

Before opening a PR, please verify:

- The app starts without errors (`./run.sh`).
- `GET /api/health` returns a healthy status.
- Face detection and recognition work with the dummy dataset.
- Enrolling, searching, editing, merging, and deleting records still work.
- The Rust library builds cleanly (`cargo build --release`) and the Python bridge loads it.
- No real personal or biometric data is included in your commit.

If you add new functionality, include steps to reproduce or test it in your PR description.

## Commit Messages

Use short, clear messages in the imperative mood:

```
Add batch enrollment endpoint
Fix FAISS index rebuild after profile merge
Update README with new API parameters
```

## Pull Request Checklist

- [ ] The PR has a clear title and description of what changed and why.
- [ ] Changes are focused on a single purpose.
- [ ] Code follows the guidelines above.
- [ ] Documentation is updated where needed (README, API reference).
- [ ] No credentials, real biometric data, or personal information is committed.
- [ ] Tested locally.

Maintainers may request changes, modify, or close pull requests that do not meet project standards, licensing terms, or responsible-use principles.

## Reporting Bugs

Open an issue and include:

- A clear description of the problem
- Steps to reproduce
- Expected and actual behavior
- Environment (OS, architecture, Python version, Rust version)
- Relevant logs or error output (with personal data removed)

## Suggesting Features

Open an issue describing the use case, the proposed behavior, and how it fits responsible, lawful use of biometric technology.

## Security and Privacy Reports

Do not open public issues for vulnerabilities or privacy leaks. Contact the maintainer through [github.com/h9zdev](https://github.com/h9zdev) and include enough detail to reproduce the issue. Reports are handled as confidentially as reasonably possible.

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project.

---

**Faced Development Team**  
Building technology responsibly. Respecting privacy. Prioritizing security.
