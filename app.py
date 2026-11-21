# -*- coding: utf-8 -*-
"""
FACED — Face Recognition & Identity Intelligence Standalone Platform
Combines:
  - OpenCV YuNet Deep Neural Network Face Detector
  - OpenCV SFace Deep Face Embedder (128D vectors)
  - Native Rust C-ABI Accelerated Engine (Rayon SIMD Cosine Distance & NMS)
  - Facebook Research FAISS (Fast Exact Inner-Product / Cosine Similarity Vector Store)
  - Document & PDF OCR Identity Pipeline
  - SQLite Biometric & Metadata Vault
"""

import os
import io
import re
import json
import base64
import hashlib
from PIL import Image, ExifTags
import requests
from flask import Flask, request, jsonify, render_template, send_from_directory

from modules.face_bridge import is_rust_accelerated
from modules.face_database import get_face_db
from modules.face_service import analyze_face_image
from modules.ocr_service import process_image_ocr

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload


def _extract_exif_metadata(image_bytes, img_w, img_h):
    """Extract EXIF, camera, GPS and technical metadata from image bytes."""
    exif_data = {
        'cameraMake': 'Unknown',
        'cameraModel': 'Standard Digital Image',
        'dateTime': 'Not Available',
        'software': 'OpenCV Engine',
        'latitude': None,
        'longitude': None,
        'gpsCoordinates': 'Not Encoded',
        'resolution': f"{img_w} x {img_h} px",
        'aspectRatio': f"{round(img_w / (img_h or 1), 2)}:1",
        'fileSize': f"{round(len(image_bytes) / 1024, 1)} KB",
        'focalLength': 'N/A',
        'exposure': 'N/A',
        'iso': 'N/A',
        'flash': 'N/A',
        'sourcesUsed': [],
        'allTags': {}
    }

    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        exif = pil_img.getexif()
        if exif:
            exif_data['sourcesUsed'].append('PIL.Exif')
            for tag_id, value in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                exif_data['allTags'][f"PIL:{tag_name}"] = str(value).strip()
                if tag_name == 'Make' and exif_data['cameraMake'] == 'Unknown':
                    exif_data['cameraMake'] = str(value).strip()
                elif tag_name == 'Model' and exif_data['cameraModel'] == 'Standard Digital Image':
                    exif_data['cameraModel'] = str(value).strip()
                elif tag_name in ['DateTimeOriginal', 'DateTime'] and exif_data['dateTime'] == 'Not Available':
                    exif_data['dateTime'] = str(value).strip()

            exif_ifd = exif.get_ifd(36867)
            if exif_ifd:
                for k, v in exif_ifd.items():
                    name = ExifTags.TAGS.get(k, str(k))
                    exif_data['allTags'][f"PIL_EXIF:{name}"] = str(v).strip()
                    if name in ['DateTimeOriginal', 'DateTimeDigitized'] and exif_data['dateTime'] == 'Not Available':
                        exif_data['dateTime'] = str(v).strip()

            gps_ifd = exif.get_ifd(34853)
            if gps_ifd:
                gps_tags = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}
                if 'GPSLatitude' in gps_tags and 'GPSLongitude' in gps_tags:
                    def _pil_deg(val):
                        return float(val[0]) + (float(val[1]) / 60.0) + (float(val[2]) / 3600.0)
                    lat = _pil_deg(gps_tags['GPSLatitude'])
                    if str(gps_tags.get('GPSLatitudeRef', 'N')).upper() in ['S', 'SOUTH']:
                        lat = -lat
                    lon = _pil_deg(gps_tags['GPSLongitude'])
                    if str(gps_tags.get('GPSLongitudeRef', 'E')).upper() in ['W', 'WEST']:
                        lon = -lon
                    exif_data['latitude'] = round(lat, 6)
                    exif_data['longitude'] = round(lon, 6)
                    exif_data['gpsCoordinates'] = f"{round(lat, 6)}°, {round(lon, 6)}°"
    except Exception as pe:
        pass

    return exif_data


def _run_greverse_image_search(image_bytes, file_name):
    """Generate visual reverse search links."""
    search_seed = requests.utils.quote(file_name or 'face.png')
    return [
        {
            'engine': 'Google Lens / GReverse',
            'icon': 'fab fa-google',
            'title': 'Google Visual Search & Reverse Image Match',
            'url': f'https://lens.google.com/uploadbyurl?url=https://www.google.com/searchbyimage?q={search_seed}',
            'directUploadUrl': 'https://www.google.com/searchbyimage/upload',
            'type': 'Google Lens API'
        },
        {
            'engine': 'Bing Visual Search',
            'icon': 'fab fa-microsoft',
            'title': 'Microsoft Bing Reverse Image Recognition',
            'url': f'https://www.bing.com/images/searchbyimage?cbir=sbi&q={search_seed}',
            'type': 'Bing Visual Index'
        },
        {
            'engine': 'Yandex Visual Match',
            'icon': 'fas fa-globe',
            'title': 'Yandex Facial Recognition Index',
            'url': f'https://yandex.com/images/search?rpt=imageview&url={search_seed}',
            'type': 'Yandex Visual AI'
        },
        {
            'engine': 'TinEye Reverse Search',
            'icon': 'fas fa-eye',
            'title': 'TinEye Visual Duplicate Match',
            'url': f'https://tineye.com/search?url={search_seed}',
            'type': 'TinEye Fingerprint'
        }
    ]


def _build_public_search_results(analysis):
    """Aggregate public OSINT matches and verified database profiles."""
    results = []
    seen = set()
    for face in analysis.get('faces', []):
        top = face.get('matchedIdentity')
        if top and top.get('id') not in seen:
            seen.add(top.get('id'))
            results.append({
                'source': 'FACED Biometric Database',
                'title': f"Identity Match: {top.get('name')}",
                'link': '#',
                'similarity': top.get('cosineSimilarity', 0),
                'matchPct': top.get('matchPct', 0),
                'snippet': f"Enrolled Identity #{top.get('id')} — Confidence: {top.get('matchPct', 0)}% (Cosine: {top.get('cosineSimilarity', 0)})"
            })
    return results


# ════════════════════════════════════════════════════════════════════════════════
# CORE WEB UI
# ════════════════════════════════════════════════════════════════════════════════
@app.route('/')
def index():
    """Main standalone Face Recognition & Identity Intelligence Dashboard."""
    db = get_face_db()
    stats = db.get_stats()
    return render_template('index.html', stats=stats)


# ════════════════════════════════════════════════════════════════════════════════
# FACE RECOGNITION & IDENTITY INTELLIGENCE REST APIS
# ════════════════════════════════════════════════════════════════════════════════
@app.route('/api/health', methods=['GET'])
def health():
    """System health check and engine capability telemetry."""
    db = get_face_db()
    stats = db.get_stats()
    return jsonify({
        'status': 'healthy',
        'platform': 'FACED Intelligence Engine',
        'rust_simd_accelerated': is_rust_accelerated(),
        'faiss_vector_index': stats.get('faissReady', False),
        'total_enrolled_faces': stats.get('totalFaces', 0),
        'total_indexed_vectors': stats.get('faissVectors', 0),
        'vector_dimension': stats.get('vectorDimension', 128)
    })


@app.route('/api/face/recognition', methods=['POST'])
def face_recognition_api():
    """Full biometric scan: detects faces, extracts 128D embeddings, searches FAISS, extracts EXIF & OCR."""
    if 'image' not in request.files and not request.data:
        return jsonify({'status': 'error', 'error': 'No image provided'}), 400

    uploaded = request.files.get('image')
    if uploaded and uploaded.filename:
        image_bytes = uploaded.read()
        file_name = uploaded.filename
    else:
        image_bytes = request.data
        file_name = 'upload.png'

    if not image_bytes:
        return jsonify({'status': 'error', 'error': 'Image payload empty'}), 400

    try:
        analysis = analyze_face_image(image_bytes, file_name)

        if analysis.get('isPdf'):
            exif_info = {
                'cameraMake': 'Poppler / PDF Engine',
                'cameraModel': f"Digital PDF ({analysis.get('pageCount', 1)} Page{'s' if analysis.get('pageCount', 1) > 1 else ''})",
                'dateTime': 'Vector Document Stream'
            }
            greverse_search = []
        else:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            img_w, img_h = image.size
            exif_info = _extract_exif_metadata(image_bytes, img_w, img_h)
            greverse_search = _run_greverse_image_search(image_bytes, file_name)

        analysis['exif'] = exif_info
        analysis['gReverse'] = greverse_search
        public_search = _build_public_search_results(analysis)

        return jsonify({
            'status': 'success',
            'analysis': analysis,
            'publicSearch': public_search
        })
    except Exception as exc:
        print(f"[FACED] Face recognition API error: {exc}")
        return jsonify({'status': 'error', 'error': str(exc)}), 500


@app.route('/api/face/database/add', methods=['POST'])
def add_face_to_database():
    """Enroll a new identity into the Face Database and FAISS vector index."""
    data = request.get_json(force=True, silent=True) or {}
    name = data.get('name')
    embedding = data.get('embedding')
    thumbnail = data.get('thumbnail')
    notes = data.get('notes', '')
    dob = data.get('dob', '')
    address = data.get('address', '')
    id_number = data.get('id_number') or data.get('idNumber', '')
    document_type = data.get('document_type') or data.get('documentType', 'Identity Document')
    ocr_raw_text = data.get('ocr_raw_text') or data.get('ocrRawText', '')
    metadata = data.get('metadata', {})
    exif_data = data.get('exif') or data.get('exif_data')
    quality_score = data.get('quality_score') or data.get('qualityScore')
    blood_group = data.get('blood_group') or data.get('bloodGroup', '')
    email = data.get('email', '')
    phone = data.get('phone', '')
    relative_name = data.get('relative_name') or data.get('relativeName', '')
    relative_relation = data.get('relative_relation') or data.get('relativeRelation', '')
    relative_other_explain = data.get('relative_other_explain') or data.get('relativeOtherExplain', '')
    custom_fields = data.get('custom_fields') or data.get('customFields', {})

    if not name or not embedding:
        return jsonify({'status': 'error', 'error': 'Person name and 128D facial embedding are required.'}), 400

    try:
        db = get_face_db()
        result = db.add_face(
            name=name,
            embedding=embedding,
            thumbnail=thumbnail,
            notes=notes,
            dob=dob,
            address=address,
            id_number=id_number,
            document_type=document_type,
            ocr_raw_text=ocr_raw_text,
            exif_data=exif_data,
            quality_score=quality_score,
            metadata=metadata,
            blood_group=blood_group,
            email=email,
            phone=phone,
            relative_name=relative_name,
            relative_relation=relative_relation,
            relative_other_explain=relative_other_explain,
            custom_fields=custom_fields
        )
        return jsonify({
            'status': 'success',
            'record': result,
            'message': f"Enrolled '{name}' into Face Database (FAISS index #{result['id']})."
        })
    except Exception as e:
        print(f"[FACED] Error adding face to database: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/link', methods=['POST'])
def link_face_to_profile_route():
    """Link an additional 128D embedding to an existing profile in FAISS."""
    data = request.get_json(force=True, silent=True) or {}
    profile_id = data.get('profile_id') or data.get('profileId')
    embedding = data.get('embedding')
    thumbnail = data.get('thumbnail')
    exif_data = data.get('exif') or data.get('exif_data')
    quality_score = data.get('quality_score') or data.get('qualityScore')
    merge_fields = data.get('merge_fields') or data.get('mergeFields', {})

    if not profile_id or not embedding:
        return jsonify({'status': 'error', 'error': 'Profile ID and face embedding are required.'}), 400

    try:
        db = get_face_db()
        result = db.link_face_to_profile(
            profile_id=int(profile_id),
            embedding=embedding,
            thumbnail=thumbnail,
            exif_data=exif_data,
            quality_score=quality_score,
            merge_fields=merge_fields
        )
        return jsonify({
            'status': 'success',
            'record': result,
            'message': result['message']
        })
    except Exception as e:
        print(f"[FACED] Error linking face to profile: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/list', methods=['GET'])
def list_face_database():
    """Fetch all enrolled profiles with thumbnails, photo counts, and FAISS stats."""
    try:
        db = get_face_db()
        limit = int(request.args.get('limit', 100))
        q = request.args.get('q') or request.args.get('search')
        faces = db.list_faces(query=q, limit=limit)
        stats = db.get_stats()
        return jsonify({
            'status': 'success',
            'faces': faces,
            'stats': stats
        })
    except Exception as e:
        print(f"[FACED] Error listing face database: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/delete/<int:face_id>', methods=['POST', 'DELETE'])
def delete_face_from_database(face_id):
    """Delete a person profile from SQLite and rebuild FAISS index."""
    try:
        db = get_face_db()
        deleted = db.delete_face(face_id)
        stats = db.get_stats()
        if deleted:
            return jsonify({'status': 'success', 'deleted': True, 'stats': stats})
        else:
            return jsonify({'status': 'error', 'error': 'Record not found'}), 404
    except Exception as e:
        print(f"[FACED] Error deleting face {face_id}: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/stats', methods=['GET'])
def face_database_stats():
    """Retrieve vector store and biometric count metrics."""
    try:
        db = get_face_db()
        return jsonify({'status': 'success', 'stats': db.get_stats()})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/update/<int:face_id>', methods=['POST', 'PUT'])
def update_face_in_database(face_id):
    """Update profile metadata (Name, DOB, ID Number, Address, Blood Group, Phone, Email, Relatives)."""
    data = request.get_json(force=True, silent=True) or {}
    try:
        db = get_face_db()
        updated = db.update_face(
            face_id=face_id,
            name=data.get('name'),
            dob=data.get('dob'),
            id_number=data.get('id_number') or data.get('idNumber'),
            document_type=data.get('document_type') or data.get('documentType'),
            address=data.get('address'),
            notes=data.get('notes'),
            blood_group=data.get('blood_group') or data.get('bloodGroup'),
            email=data.get('email'),
            phone=data.get('phone'),
            relative_name=data.get('relative_name') or data.get('relativeName'),
            relative_relation=data.get('relative_relation') or data.get('relativeRelation'),
            relative_other_explain=data.get('relative_other_explain') or data.get('relativeOtherExplain'),
            custom_fields=data.get('custom_fields') or data.get('customFields')
        )
        return jsonify({'status': 'success', 'record': updated, 'message': f"Updated profile for '{updated.get('name', 'ID ' + str(face_id))}'."})
    except Exception as e:
        print(f"[FACED] Error updating face #{face_id}: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/merge', methods=['POST'])
def merge_faces_in_database():
    """Merge duplicate profiles in SQLite & FAISS."""
    data = request.get_json(force=True, silent=True) or {}
    source_id = data.get('source_id') or data.get('sourceId')
    target_id = data.get('target_id') or data.get('targetId')

    if not source_id or not target_id:
        return jsonify({'status': 'error', 'error': 'Both source_id and target_id are required.'}), 400

    try:
        db = get_face_db()
        res = db.merge_profiles(int(source_id), int(target_id))
        stats = db.get_stats()
        return jsonify({'status': 'success', 'result': res, 'stats': stats, 'message': res['message']})
    except Exception as e:
        print(f"[FACED] Error merging profiles {source_id} -> {target_id}: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/face/database/search_image', methods=['POST'])
def search_face_database_image():
    """Biometric search by photo or PDF directly against the enrolled database."""
    image_bytes = None
    file_name = 'query_face.png'

    if 'image' in request.files:
        uploaded = request.files['image']
        image_bytes = uploaded.read()
        file_name = uploaded.filename or file_name
    elif request.is_json:
        data = request.get_json(silent=True) or {}
        img_b64 = data.get('image') or data.get('imageBase64')
        if img_b64:
            if ',' in img_b64:
                img_b64 = img_b64.split(',', 1)[1]
            image_bytes = base64.b64decode(img_b64)
    elif request.data:
        image_bytes = request.data

    if not image_bytes:
        return jsonify({'status': 'error', 'error': 'No image provided for face search'}), 400

    try:
        analysis = analyze_face_image(image_bytes, file_name)

        if analysis.get('isPdf'):
            exif_info = {
                'cameraMake': 'Poppler / PDF Engine',
                'cameraModel': f"Digital PDF ({analysis.get('pageCount', 1)} Page{'s' if analysis.get('pageCount', 1) > 1 else ''})",
                'dateTime': 'Vector Document Stream'
            }
        else:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            img_w, img_h = image.size
            exif_info = _extract_exif_metadata(image_bytes, img_w, img_h)
        analysis['exif'] = exif_info

        detected_faces = analysis.get('faces', [])
        matches = []
        for face in detected_faces:
            top = face.get('matchedIdentity')
            if top:
                matches.append({
                    'face_index': face.get('faceIndex', 1),
                    'similarity': top.get('cosineSimilarity', 0.0),
                    'matchPct': top.get('matchPct', 0),
                    'profile': top,
                    'name': top.get('name'),
                    'thumbnail': top.get('thumbnail'),
                    'dob': top.get('dob'),
                    'id_number': top.get('idNumber') or top.get('id_number'),
                    'document_type': top.get('documentType') or top.get('document_type'),
                    'notes': top.get('notes'),
                    'photo_count': top.get('photoCount') or top.get('photo_count', 1),
                    'id': top.get('id')
                })

        return jsonify({
            'status': 'success',
            'face_count': len(detected_faces),
            'faceCount': len(detected_faces),
            'matches': matches,
            'matchedIdentities': matches,
            'detectedFaces': detected_faces,
            'analysis': analysis
        })
    except Exception as exc:
        print(f"[FACED] Search face database image error: {exc}")
        return jsonify({'status': 'error', 'error': str(exc)}), 500


@app.route('/api/face/ocr', methods=['POST'])
def process_face_ocr():
    """Extract structured document text and identity fields via OCR."""
    try:
        image_bytes = None
        mode = request.args.get('mode', 'general')

        if 'image' in request.files:
            image_bytes = request.files['image'].read()
            if not mode or mode == 'general':
                mode = request.form.get('mode', 'general')
        elif request.is_json:
            data = request.get_json(silent=True) or {}
            img_b64 = data.get('image') or data.get('imageBase64')
            if data.get('mode'):
                mode = data.get('mode')
            if img_b64:
                if ',' in img_b64:
                    img_b64 = img_b64.split(',', 1)[1]
                image_bytes = base64.b64decode(img_b64)
        elif request.data:
            image_bytes = request.data

        if not image_bytes:
            return jsonify({'status': 'error', 'error': 'No image provided for OCR'}), 400

        result = process_image_ocr(image_bytes, mode=mode)
        return jsonify({'status': 'success', 'ocr': result})
    except Exception as e:
        print(f"[FACED] OCR endpoint error: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8005))
    host = os.environ.get('HOST', '0.0.0.0')
    print("=" * 65)
    print("  FACED — FACE RECOGNITION & IDENTITY INTELLIGENCE PLATFORM")
    print(f"  Access URL: http://127.0.0.1:{port}")
    print(f"  Rust SIMD Engine: {'ACTIVE' if is_rust_accelerated() else 'FALLBACK'}")
    print("=" * 65)
    app.run(host=host, port=port, debug=False)
