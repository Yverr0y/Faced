#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================="
echo "  FACED — Face Recognition & Identity Intelligence Setup "
echo "========================================================="

# 1. Compile Rust Acceleration Engine
echo "[1/4] Building Rust Rayon SIMD acceleration engine..."
if command -v cargo &> /dev/null; then
    bash "$SCRIPT_DIR/rust_engine/build.sh"
else
    echo "⚠️  Cargo not found. Using precompiled libfaced_rs.so binary."
fi

# 2. Setup Python Environment
echo "[2/4] Verifying Python 3 environment..."
python3 -c "import cv2, numpy, PIL, flask" 2>/dev/null || {
    echo "Installing Python dependencies from requirements.txt..."
    pip install -r "$SCRIPT_DIR/requirements.txt"
}

# 3. Verify Biometric Database and FAISS Index
echo "[3/4] Verifying SQLite database and FAISS vector index..."
python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR')
from modules.face_database import get_face_db
db = get_face_db()
stats = db.get_stats()
print(f'✓ Face Database: {stats.get(\"totalFaces\", 0)} identities, {stats.get(\"faissVectors\", 0)} indexed vectors.')
"

# 4. Verify ONNX Neural Models
echo "[4/4] Verifying OpenCV YuNet & SFace ONNX models..."
python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR')
from modules.face_service import init_face_models
if init_face_models():
    print('✓ YuNet Detector & SFace 128D Embedder initialized successfully.')
else:
    print('⚠️ Models not found or failed to load.')
"

echo ""
echo "========================================================="
echo "  FACED platform setup completed successfully!           "
echo "  Launch the platform using: ./run.sh                    "
echo "========================================================="
