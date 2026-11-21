# Security Policy

Faced processes biometric data, including face embeddings and identity records, so security and privacy issues are taken seriously.

## Supported Versions

Faced is under active development. Security fixes are applied to the latest code on the `main` branch only.

| Version | Supported |
| --- | --- |
| `main` (latest) | Yes |
| Older commits and forks | No |

## Reporting a Vulnerability

**Do not open a public issue, pull request, or discussion for security or privacy vulnerabilities.**

Report privately using one of these:

1. **GitHub Private Vulnerability Reporting (preferred):** go to the [Security tab](https://github.com/h9zdev/Faced/security) of the repository and select "Report a vulnerability".
2. **Direct contact:** reach the maintainer through [github.com/h9zdev](https://github.com/h9zdev) and ask for a private channel. Do not include exploit details in public messages.

### What to Include

- A clear description of the vulnerability and its impact
- Steps to reproduce, or a proof of concept
- Affected files, endpoints, or components
- Your environment (OS, architecture, Python version, Rust version)
- Any suggested fix or mitigation

**Do not include real biometric data, real personal records, or real images of people in your report.** Use dummy data (see `seed_dummy_database.py`) or synthetic samples.

## What to Expect

- Acknowledgment of your report within a reasonable time.
- An assessment of severity and impact.
- Updates as the issue is investigated and fixed.
- Credit in the fix notes if you want it. Tell us if you prefer to stay anonymous.

Please allow time to investigate and release a fix before any public disclosure. Reports are handled as confidentially as reasonably possible.

## Scope

In scope:

- **API endpoints** in `app.py` (`/api/face/*`, `/api/health`), including authentication gaps, injection, and input validation flaws
- **File upload handling** for images and PDFs (malformed files, path traversal, resource exhaustion)
- **SQLite and FAISS data stores**, including SQL injection and unauthorized access to records or embeddings
- **Rust native library** (`rust_engine/`, `libfaced_rs.so`) and the `ctypes` bridge, including memory safety bugs, out-of-bounds reads or writes, and unsafe FFI usage
- **Web UI** (`templates/`, `static/`), including XSS from stored profile fields such as names, notes, and addresses
- **Privacy leaks**, such as exposure of embeddings, thumbnails, identity records, or EXIF and GPS data
- **Secrets or credentials** accidentally committed to the repository
- **Dependency vulnerabilities** that are exploitable in Faced

Out of scope:

- Vulnerabilities in third-party dependencies with no demonstrated impact on Faced
- Issues that require physical access to an already-compromised machine
- Denial of service through unrealistic traffic volumes
- Social engineering of maintainers or contributors
- Face recognition accuracy limits, false matches, or model bias (report these as normal issues)
- Findings from automated scanners without a demonstrated impact

## Safe Harbor

If you act in good faith, follow this policy, and avoid privacy violations, data destruction, and service disruption, we will not pursue action against you for your research. Please:

- Test only on your own local installation or with dummy data.
- Do not access, copy, or keep real people's biometric or personal data.
- Report the issue before disclosing it publicly.

## Deployment Guidance for Users

Faced is designed for local, authorized use. If you run it:

- **Do not expose it to the public internet** without authentication, TLS, and a reverse proxy.
- By default, bind to `127.0.0.1` rather than `0.0.0.0`.
- Restrict file permissions on `data/face_database.db` and `data/face_vectors.faiss`.
- Encrypt disks or backups that contain biometric data.
- Keep Python dependencies and the Rust toolchain up to date.
- Collect and process biometric data only where legally authorized and with consent, as required by the [Code of Conduct](CODE_OF_CONDUCT.md).
- Rebuild `libfaced_rs.so` from source (`rust_engine/build.sh`) rather than trusting a prebuilt binary from an unknown source.

## Responsible Use

Misuse of Faced for unauthorized surveillance, stalking, harassment, or unlawful identification is not a security vulnerability but a Code of Conduct violation. Report it as described in the [Code of Conduct](CODE_OF_CONDUCT.md).

---

**Faced Development Team**  
Building technology responsibly. Respecting privacy. Prioritizing security.
