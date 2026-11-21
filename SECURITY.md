# Security Policy

## Supported Versions

Security updates and critical patches are actively applied to the following release branches of **FACED**:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| `main`  | :white_check_mark: | Active Development & Current Release |
| `< 1.0` | :x:                | Deprecated |

---

## Reporting a Vulnerability

We take the security and integrity of the **FACED** biometric platform seriously. If you discover a security vulnerability or sensitive privacy issue, please follow these responsible disclosure steps:

### 1. How to Report
- **Preferred Method**: Open a Private Security Advisory via GitHub under [Security > Advisories](https://github.com/h9zdev/Faced/security/advisories/new).
- **Alternative**: Contact the repository owner directly through official GitHub channels.
- **Do NOT**: Open a public GitHub Issue for unpatched security vulnerabilities or exploit code.

### 2. What to Include in Your Report
Please provide as much relevant information as possible to expedite remediation:
- Description of the vulnerability (e.g., buffer overrun in native C-ABI, memory corruption, SQL injection, unauthorized path traversal).
- Steps to reproduce the issue, including proof-of-concept (PoC) code or inputs where applicable.
- Affected components (e.g., `modules/face_bridge.py`, `rust_engine/`, `modules/face_database.py`, `app.py`).
- Potential impact (e.g., Denial of Service, unauthorized vector exfiltration, arbitrary code execution).
- Any recommended remediations or patches.

### 3. Response Timelines
- **Initial Acknowledgment**: Within **48 hours** of report receipt.
- **Triage & Assessment**: Within **5 business days**.
- **Fix & Disclosure**: Critical fixes will be committed directly to `main` with appropriate attribution to the reporter (unless anonymity is requested).

---

## Biometric Data & Privacy Principles

**FACED** is strictly designed with zero-telemetry and local execution guarantees:
1. **Local-Only Processing**: All neural models (YuNet, SFace, RapidOCR) execute locally on host silicon.
2. **Zero Cloud Exfiltration**: No facial vectors, embeddings, or biometric photos are transmitted to external servers, cloud providers, or third-party analytical endpoints.
3. **Database Security**: Persistent facial vectors and identities are stored in encrypted or permissions-restricted SQLite vaults (`data/face_database.db`) using parameterized queries to prevent SQL injection.
4. **Air-Gap Capable**: The platform is fully operable in isolated, air-gapped environments without internet access.
