#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================="
echo "   Building FACED Rust Native Acceleration Engine (SIMD)  "
echo "========================================================="

if ! command -v cargo &> /dev/null; then
    echo "Error: cargo (Rust package manager) not found in PATH."
    echo "Install Rust via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

cargo build --release

DEST_DIR="$SCRIPT_DIR/../modules"
mkdir -p "$DEST_DIR"
cp -f target/release/libfaced_rs.so "$DEST_DIR/libfaced_rs.so"

echo "✓ Rust library successfully built: $DEST_DIR/libfaced_rs.so"
echo "========================================================="
