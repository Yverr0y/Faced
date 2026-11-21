"""
HayOS Face Database & FAISS Vector Store
Integrates SQLite persistent storage with Facebook Research FAISS (IndexFlatIP) and Rust acceleration.
"""

import os
import json
import sqlite3
import hashlib
import threading
import numpy as np

try:
    import faiss
    _FAISS_AVAILABLE = True
except Exception as e:
    _FAISS_AVAILABLE = False
    print(f"[Face DB] FAISS not available, using Rust batch vector search fallback: {e}")

from modules.face_bridge import rust_cosine_similarity, rust_l2_distance, rust_batch_cosine_similarity

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DB_FILE = os.path.join(DB_DIR, 'face_database.db')
FAISS_FILE = os.path.join(DB_DIR, 'face_vectors.faiss')

class FaceDatabase:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            with cls._lock:
                if not cls._instance:
                    cls._instance = super(FaceDatabase, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if getattr(self, '_initialized', False):
            return
        self._initialized = True
        os.makedirs(DB_DIR, exist_ok=True)
        self.lock = threading.RLock()
        self.faiss_index = None
        self.id_to_db_id = [] # mapping from faiss position to sqlite id
        self._init_sqlite()
        self._build_faiss_index()

    def _get_conn(self):
        conn = sqlite3.connect(DB_FILE, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=10000")
        except Exception:
            pass
        return conn

    def _init_sqlite(self):
        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("""
                CREATE TABLE IF NOT EXISTS face_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    notes TEXT,
                    thumbnail TEXT,
                    embedding_json TEXT NOT NULL,
                    embedding_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata_json TEXT
                )
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_face_name ON face_records(name)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_face_hash ON face_records(embedding_hash)")

            # Auto-migrate additional identity/OCR columns
            columns_to_add = [
                ('dob', 'TEXT'),
                ('address', 'TEXT'),
                ('id_number', 'TEXT'),
                ('document_type', 'TEXT'),
                ('blood_group', 'TEXT'),
                ('email', 'TEXT'),
                ('phone', 'TEXT'),
                ('relative_name', 'TEXT'),
                ('relative_relation', 'TEXT'),
                ('relative_other_explain', 'TEXT'),
                ('custom_fields_json', 'TEXT'),
                ('ocr_raw_text', 'TEXT'),
                ('exif_json', 'TEXT'),
                ('photo_count', 'INTEGER DEFAULT 1')
            ]
            for col, col_type in columns_to_add:
                try:
                    c.execute(f"ALTER TABLE face_records ADD COLUMN {col} {col_type}")
                except Exception:
                    pass

            c.execute("CREATE INDEX IF NOT EXISTS idx_face_id_num ON face_records(id_number)")

            # Table for multi-photo identity profiles: each profile can have multiple face vectors/photos
            c.execute("""
                CREATE TABLE IF NOT EXISTS face_profile_embeddings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_id INTEGER NOT NULL,
                    thumbnail TEXT,
                    embedding_json TEXT NOT NULL,
                    embedding_hash TEXT,
                    exif_json TEXT,
                    quality_score REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(profile_id) REFERENCES face_records(id) ON DELETE CASCADE
                )
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_emb_profile_id ON face_profile_embeddings(profile_id)")

            # Auto-backfill existing profiles into face_profile_embeddings if missing
            try:
                c.execute("""
                    INSERT INTO face_profile_embeddings (profile_id, thumbnail, embedding_json, embedding_hash, exif_json, created_at)
                    SELECT id, thumbnail, embedding_json, embedding_hash, exif_json, created_at FROM face_records
                    WHERE id NOT IN (SELECT DISTINCT profile_id FROM face_profile_embeddings)
                """)
                # Update photo_count based on embeddings count
                c.execute("""
                    UPDATE face_records SET photo_count = (
                        SELECT COUNT(*) FROM face_profile_embeddings WHERE face_profile_embeddings.profile_id = face_records.id
                    )
                """)
            except Exception as e:
                print(f"[Face DB] Backfill note: {e}")

            conn.commit()
            conn.close()

    def _build_faiss_index(self):
        with self.lock:
            vectors = []
            profile_ids = []
            embedding_ids = []
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("SELECT id, profile_id, embedding_json FROM face_profile_embeddings ORDER BY id ASC")
            rows = c.fetchall()
            conn.close()

            for r in rows:
                try:
                    vec = np.array(json.loads(r['embedding_json']), dtype=np.float32)
                    if len(vec) == 128:
                        norm = np.linalg.norm(vec)
                        if norm > 1e-7:
                            vec = vec / norm
                        vectors.append(vec)
                        profile_ids.append(r['profile_id'])
                        embedding_ids.append(r['id'])
                except Exception:
                    continue

            self.id_to_db_id = profile_ids
            self.id_to_emb_id = embedding_ids

            if _FAISS_AVAILABLE:
                self.faiss_index = faiss.IndexFlatIP(128)
                if len(vectors) > 0:
                    v_mat = np.array(vectors, dtype=np.float32)
                    self.faiss_index.add(v_mat)
                    try:
                        faiss.write_index(self.faiss_index, FAISS_FILE)
                    except Exception as e:
                        print(f"[Face DB] Error persisting FAISS index: {e}")
                print(f"[Face DB] FAISS Index initialized with {len(vectors)} registered face vectors across {len(set(profile_ids))} identities.")
            else:
                self.faiss_index = None
                print(f"[Face DB] Vector search initialized via Rust engine with {len(vectors)} vectors.")

    def add_face(self, name, embedding, thumbnail=None, notes=None, dob=None, address=None, id_number=None, document_type=None,
                 ocr_raw_text=None, exif_data=None, quality_score=None, metadata=None,
                 blood_group=None, email=None, phone=None, relative_name=None, relative_relation=None,
                 relative_other_explain=None, custom_fields=None):
        """
        Create a new identity profile with facial embedding, OCR data, relatives, blood group, contact info, and custom fields.
        """
        if not name or embedding is None or len(embedding) == 0:
            raise ValueError("Name and embedding are required.")

        vec = np.array(embedding, dtype=np.float32).flatten()
        if len(vec) != 128:
            raise ValueError(f"Expected 128-dimensional embedding, got {len(vec)}")

        norm = np.linalg.norm(vec)
        if norm > 1e-7:
            normalized_vec = (vec / norm).astype(np.float32)
        else:
            normalized_vec = vec.astype(np.float32)

        emb_bytes = normalized_vec.tobytes()
        emb_hash = "SFACE-" + hashlib.sha256(emb_bytes).hexdigest()[:14].upper()
        exif_json_str = json.dumps(exif_data or {})
        custom_fields_json_str = json.dumps(custom_fields or {}) if isinstance(custom_fields, dict) else (custom_fields or '{}')

        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("""
                INSERT INTO face_records (
                    name, notes, thumbnail, embedding_json, embedding_hash,
                    metadata_json, dob, address, id_number, document_type, ocr_raw_text,
                    exif_json, photo_count,
                    blood_group, email, phone, relative_name, relative_relation,
                    relative_other_explain, custom_fields_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
            """, (
                name.strip(),
                notes.strip() if notes else '',
                thumbnail or '',
                json.dumps(normalized_vec.tolist()),
                emb_hash,
                json.dumps(metadata or {}),
                dob.strip() if dob else '',
                address.strip() if address else '',
                id_number.strip() if id_number else '',
                document_type.strip() if document_type else 'Identity Document',
                ocr_raw_text or '',
                exif_json_str,
                blood_group.strip() if blood_group else '',
                email.strip() if email else '',
                phone.strip() if phone else '',
                relative_name.strip() if relative_name else '',
                relative_relation.strip() if relative_relation else '',
                relative_other_explain.strip() if relative_other_explain else '',
                custom_fields_json_str
            ))
            new_id = c.lastrowid

            # Also register into face_profile_embeddings
            c.execute("""
                INSERT INTO face_profile_embeddings (
                    profile_id, thumbnail, embedding_json, embedding_hash, exif_json, quality_score
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                new_id,
                thumbnail or '',
                json.dumps(normalized_vec.tolist()),
                emb_hash,
                exif_json_str,
                float(quality_score) if quality_score is not None else 85.0
            ))
            emb_row_id = c.lastrowid
            conn.commit()
            conn.close()

            # Update FAISS and memory mapping
            self.id_to_db_id.append(new_id)
            self.id_to_emb_id.append(emb_row_id)
            if _FAISS_AVAILABLE and self.faiss_index is not None:
                self.faiss_index.add(np.array([normalized_vec], dtype=np.float32))
                try:
                    faiss.write_index(self.faiss_index, FAISS_FILE)
                except Exception as e:
                    print(f"[Face DB] FAISS write error: {e}")

            return {
                'id': new_id,
                'name': name.strip(),
                'dob': dob.strip() if dob else '',
                'address': address.strip() if address else '',
                'idNumber': id_number.strip() if id_number else '',
                'documentType': document_type.strip() if document_type else '',
                'bloodGroup': blood_group.strip() if blood_group else '',
                'email': email.strip() if email else '',
                'phone': phone.strip() if phone else '',
                'relativeName': relative_name.strip() if relative_name else '',
                'relativeRelation': relative_relation.strip() if relative_relation else '',
                'relativeOtherExplain': relative_other_explain.strip() if relative_other_explain else '',
                'customFields': custom_fields or {},
                'embeddingHash': emb_hash,
                'photoCount': 1,
                'totalFaces': len(set(self.id_to_db_id))
            }

    def link_face_to_profile(self, profile_id, embedding, thumbnail=None, exif_data=None, quality_score=None, merge_fields=None):
        """
        Link an additional face photo/embedding to an existing person profile.
        Dramatically improves accuracy and avoids recognition misses.
        """
        if embedding is None or len(embedding) == 0:
            raise ValueError("Embedding is required.")

        vec = np.array(embedding, dtype=np.float32).flatten()
        if len(vec) != 128:
            raise ValueError(f"Expected 128-dimensional embedding, got {len(vec)}")

        norm = np.linalg.norm(vec)
        if norm > 1e-7:
            normalized_vec = (vec / norm).astype(np.float32)
        else:
            normalized_vec = vec.astype(np.float32)

        emb_bytes = normalized_vec.tobytes()
        emb_hash = "SFACE-" + hashlib.sha256(emb_bytes).hexdigest()[:14].upper()
        exif_json_str = json.dumps(exif_data or {})

        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("SELECT * FROM face_records WHERE id = ?", (profile_id,))
            prof = c.fetchone()
            if not prof:
                conn.close()
                raise ValueError(f"Profile #{profile_id} not found in database.")

            # Insert new embedding into face_profile_embeddings
            c.execute("""
                INSERT INTO face_profile_embeddings (
                    profile_id, thumbnail, embedding_json, embedding_hash, exif_json, quality_score
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                profile_id,
                thumbnail or '',
                json.dumps(normalized_vec.tolist()),
                emb_hash,
                exif_json_str,
                float(quality_score) if quality_score is not None else 85.0
            ))
            emb_row_id = c.lastrowid

            # Increment photo_count and conditionally merge empty fields
            c.execute("UPDATE face_records SET photo_count = photo_count + 1 WHERE id = ?", (profile_id,))

            if merge_fields and isinstance(merge_fields, dict):
                updates = []
                params = []
                for field in ['dob', 'address', 'id_number', 'document_type', 'notes',
                              'blood_group', 'email', 'phone', 'relative_name', 'relative_relation', 'relative_other_explain']:
                    val = merge_fields.get(field)
                    if val and (field not in prof.keys() or not prof[field] or str(prof[field]).strip() == ''):
                        updates.append(f"{field} = ?")
                        params.append(str(val).strip())

                if merge_fields.get('custom_fields') and isinstance(merge_fields['custom_fields'], dict):
                    existing_cf = {}
                    try:
                        if 'custom_fields_json' in prof.keys() and prof['custom_fields_json']:
                            existing_cf = json.loads(prof['custom_fields_json'])
                    except Exception:
                        pass
                    merged_cf = {**merge_fields['custom_fields'], **existing_cf}
                    updates.append("custom_fields_json = ?")
                    params.append(json.dumps(merged_cf))

                if updates:
                    params.append(profile_id)
                    c.execute(f"UPDATE face_records SET {', '.join(updates)} WHERE id = ?", params)

            conn.commit()

            # Retrieve updated photo count
            c.execute("SELECT photo_count, name FROM face_records WHERE id = ?", (profile_id,))
            updated_row = c.fetchone()
            new_photo_count = updated_row['photo_count']
            profile_name = updated_row['name']
            conn.close()

            # Update FAISS index
            self.id_to_db_id.append(profile_id)
            self.id_to_emb_id.append(emb_row_id)
            if _FAISS_AVAILABLE and self.faiss_index is not None:
                self.faiss_index.add(np.array([normalized_vec], dtype=np.float32))
                try:
                    faiss.write_index(self.faiss_index, FAISS_FILE)
                except Exception as e:
                    print(f"[Face DB] FAISS write error: {e}")

            return {
                'id': profile_id,
                'name': profile_name,
                'embeddingHash': emb_hash,
                'photoCount': new_photo_count,
                'message': f"Linked new photo to {profile_name} (Profile now has {new_photo_count} registered photos)."
            }

    def search_face(self, query_embedding, top_k=5, min_similarity=0.60):
        """
        Search for matching faces against FAISS vector database.
        Aggregates multiple photos per person to return the best match per identity profile.
        """
        vec = np.array(query_embedding, dtype=np.float32).flatten()
        if len(vec) != 128 or len(self.id_to_db_id) == 0:
            return []

        norm = np.linalg.norm(vec)
        if norm > 1e-7:
            q_norm = (vec / norm).astype(np.float32)
        else:
            q_norm = vec.astype(np.float32)

        matches = []
        with self.lock:
            # Method 1: Facebook FAISS search with multi-photo profile aggregation
            if _FAISS_AVAILABLE and self.faiss_index is not None and self.faiss_index.ntotal > 0:
                k = min(max(top_k * 4, 20), self.faiss_index.ntotal)
                D, I = self.faiss_index.search(np.array([q_norm]), k)
                top_scores = D[0]
                top_indices = I[0]

                # Group by profile_id and find MAX similarity
                profile_best_score = {}
                profile_best_vec_idx = {}
                for score, idx in zip(top_scores, top_indices):
                    if idx >= 0 and idx < len(self.id_to_db_id):
                        cos_sim = float(score)
                        if cos_sim >= min_similarity:
                            pid = self.id_to_db_id[idx]
                            if pid not in profile_best_score or cos_sim > profile_best_score[pid]:
                                profile_best_score[pid] = cos_sim
                                profile_best_vec_idx[pid] = idx

                if profile_best_score:
                    # Sort profile_ids by max similarity descending
                    sorted_pids = sorted(profile_best_score.keys(), key=lambda p: profile_best_score[p], reverse=True)[:top_k]

                    conn = self._get_conn()
                    c = conn.cursor()
                    placeholders = ','.join('?' * len(sorted_pids))
                    c.execute(f"""
                        SELECT id, name, notes, thumbnail, embedding_hash, created_at, embedding_json,
                               dob, address, id_number, document_type,
                               blood_group, email, phone, relative_name, relative_relation, relative_other_explain, custom_fields_json,
                               exif_json, photo_count
                        FROM face_records WHERE id IN ({placeholders})
                    """, sorted_pids)
                    prof_rows = {r['id']: r for r in c.fetchall()}

                    # Also fetch thumbnails of all linked photos for these profiles
                    c.execute(f"""
                        SELECT profile_id, thumbnail, quality_score, created_at
                        FROM face_profile_embeddings
                        WHERE profile_id IN ({placeholders})
                        ORDER BY id ASC
                    """, sorted_pids)
                    emb_rows = c.fetchall()
                    conn.close()

                    photos_by_profile = {}
                    for er in emb_rows:
                        pid = er['profile_id']
                        if pid not in photos_by_profile:
                            photos_by_profile[pid] = []
                        if er['thumbnail']:
                            photos_by_profile[pid].append(er['thumbnail'])

                    for pid in sorted_pids:
                        if pid in prof_rows:
                            r = prof_rows[pid]
                            sim = profile_best_score[pid]
                            db_vec = np.array(json.loads(r['embedding_json']), dtype=np.float32)
                            l2 = rust_l2_distance(q_norm, db_vec)

                            exif_parsed = {}
                            try:
                                if r['exif_json']:
                                    exif_parsed = json.loads(r['exif_json'])
                            except Exception:
                                pass

                            custom_fields_parsed = {}
                            try:
                                if 'custom_fields_json' in r.keys() and r['custom_fields_json']:
                                    custom_fields_parsed = json.loads(r['custom_fields_json'])
                            except Exception:
                                pass

                            matches.append({
                                'id': r['id'],
                                'name': r['name'],
                                'dob': r['dob'] if 'dob' in r.keys() else '',
                                'address': r['address'] if 'address' in r.keys() else '',
                                'idNumber': r['id_number'] if 'id_number' in r.keys() else '',
                                'documentType': r['document_type'] if 'document_type' in r.keys() else '',
                                'bloodGroup': r['blood_group'] if 'blood_group' in r.keys() and r['blood_group'] else '',
                                'email': r['email'] if 'email' in r.keys() and r['email'] else '',
                                'phone': r['phone'] if 'phone' in r.keys() and r['phone'] else '',
                                'relativeName': r['relative_name'] if 'relative_name' in r.keys() and r['relative_name'] else '',
                                'relativeRelation': r['relative_relation'] if 'relative_relation' in r.keys() and r['relative_relation'] else '',
                                'relativeOtherExplain': r['relative_other_explain'] if 'relative_other_explain' in r.keys() and r['relative_other_explain'] else '',
                                'customFields': custom_fields_parsed,
                                'notes': r['notes'] or '',
                                'thumbnail': r['thumbnail'] or '',
                                'allPhotos': photos_by_profile.get(pid, [r['thumbnail']])[:6],
                                'photoCount': r['photo_count'] if 'photo_count' in r.keys() and r['photo_count'] else max(1, len(photos_by_profile.get(pid, []))),
                                'embeddingHash': r['embedding_hash'],
                                'cosineSimilarity': round(sim, 4),
                                'matchPct': round(sim * 100.0, 1),
                                'l2Distance': round(l2, 4),
                                'source': 'FAISS Multi-Photo Vector Index',
                                'exif': exif_parsed,
                                'createdAt': r['created_at']
                            })

            # Method 2: Rust batch similarity fallback if FAISS didn't yield
            if not matches and len(self.id_to_db_id) > 0:
                conn = self._get_conn()
                c = conn.cursor()
                c.execute("""
                    SELECT id, profile_id, embedding_json FROM face_profile_embeddings
                """)
                rows = c.fetchall()
                conn.close()

                if rows:
                    pids = [r['profile_id'] for r in rows]
                    db_mat = np.array([json.loads(r['embedding_json']) for r in rows], dtype=np.float32)
                    sims = rust_batch_cosine_similarity(q_norm, db_mat)

                    profile_best = {}
                    for idx, sim_val in enumerate(sims):
                        pid = pids[idx]
                        if sim_val >= min_similarity:
                            if pid not in profile_best or sim_val > profile_best[pid]:
                                profile_best[pid] = float(sim_val)

                    sorted_pids = sorted(profile_best.keys(), key=lambda p: profile_best[p], reverse=True)[:top_k]
                    if sorted_pids:
                        conn = self._get_conn()
                        c = conn.cursor()
                        placeholders = ','.join('?' * len(sorted_pids))
                        c.execute(f"""
                            SELECT id, name, notes, thumbnail, embedding_hash, created_at, embedding_json,
                                   dob, address, id_number, document_type, exif_json, photo_count
                            FROM face_records WHERE id IN ({placeholders})
                        """, sorted_pids)
                        prof_map = {r['id']: r for r in c.fetchall()}
                        conn.close()

                        for pid in sorted_pids:
                            if pid in prof_map:
                                r = prof_map[pid]
                                sim = profile_best[pid]
                                matches.append({
                                    'id': r['id'],
                                    'name': r['name'],
                                    'dob': r['dob'] if 'dob' in r.keys() else '',
                                    'address': r['address'] if 'address' in r.keys() else '',
                                    'idNumber': r['id_number'] if 'id_number' in r.keys() else '',
                                    'documentType': r['document_type'] if 'document_type' in r.keys() else '',
                                    'notes': r['notes'] or '',
                                    'thumbnail': r['thumbnail'] or '',
                                    'photoCount': r['photo_count'] or 1,
                                    'embeddingHash': r['embedding_hash'],
                                    'cosineSimilarity': round(sim, 4),
                                    'matchPct': round(sim * 100.0, 1),
                                    'l2Distance': 0.0,
                                    'source': 'Rust Batch Multi-Photo Engine',
                                    'createdAt': r['created_at']
                                })

        return matches

    def list_faces(self, query=None, limit=100):
        """List registered face profiles with search filter, photo counts, and gallery."""
        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            if query and query.strip():
                q = f"%{query.strip()}%"
                c.execute("""
                    SELECT id, name, notes, thumbnail, embedding_hash, created_at,
                           dob, address, id_number, document_type, exif_json, photo_count,
                           blood_group, email, phone, relative_name, relative_relation, relative_other_explain, custom_fields_json
                    FROM face_records
                    WHERE name LIKE ? OR dob LIKE ? OR address LIKE ? OR id_number LIKE ? OR notes LIKE ?
                       OR blood_group LIKE ? OR email LIKE ? OR phone LIKE ? OR relative_name LIKE ? OR relative_relation LIKE ?
                       OR relative_other_explain LIKE ? OR custom_fields_json LIKE ?
                    ORDER BY id DESC LIMIT ?
                """, (q, q, q, q, q, q, q, q, q, q, q, q, limit))
            else:
                c.execute("""
                    SELECT id, name, notes, thumbnail, embedding_hash, created_at,
                           dob, address, id_number, document_type, exif_json, photo_count,
                           blood_group, email, phone, relative_name, relative_relation, relative_other_explain, custom_fields_json
                    FROM face_records
                    ORDER BY id DESC LIMIT ?
                """, (limit,))
            rows = c.fetchall()

            profile_ids = [r['id'] for r in rows]
            photos_map = {}
            if profile_ids:
                placeholders = ','.join('?' * len(profile_ids))
                c.execute(f"""
                    SELECT profile_id, thumbnail
                    FROM face_profile_embeddings
                    WHERE profile_id IN ({placeholders})
                    ORDER BY id ASC
                """, profile_ids)
                for pr in c.fetchall():
                    pid = pr['profile_id']
                    if pid not in photos_map:
                        photos_map[pid] = []
                    if pr['thumbnail']:
                        photos_map[pid].append(pr['thumbnail'])

            conn.close()

            results = []
            for r in rows:
                d = dict(r)
                pid = d['id']
                d['photos'] = photos_map.get(pid, [d.get('thumbnail')])[:6]
                d['photoCount'] = d.get('photo_count') or max(1, len(photos_map.get(pid, [])))
                d['bloodGroup'] = d.get('blood_group') or ''
                d['email'] = d.get('email') or ''
                d['phone'] = d.get('phone') or ''
                d['relativeName'] = d.get('relative_name') or ''
                d['relativeRelation'] = d.get('relative_relation') or ''
                d['relativeOtherExplain'] = d.get('relative_other_explain') or ''
                d['dob'] = d.get('dob') or ''
                d['address'] = d.get('address') or ''
                d['idNumber'] = d.get('id_number') or ''
                d['documentType'] = d.get('document_type') or ''

                cf = {}
                try:
                    if d.get('custom_fields_json'):
                        cf = json.loads(d['custom_fields_json'])
                except Exception:
                    pass
                d['customFields'] = cf

                try:
                    d['exif'] = json.loads(d['exif_json']) if d.get('exif_json') else {}
                except Exception:
                    d['exif'] = {}
                results.append(d)

            return results

    def update_face(self, face_id, name=None, dob=None, id_number=None, document_type=None, address=None, notes=None,
                    blood_group=None, email=None, phone=None, relative_name=None, relative_relation=None,
                    relative_other_explain=None, custom_fields=None):
        """Update identity information for an existing registered face profile."""
        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("SELECT * FROM face_records WHERE id = ?", (face_id,))
            prof = c.fetchone()
            if not prof:
                conn.close()
                raise ValueError(f"Profile #{face_id} not found in database.")

            updates = []
            params = []
            if name is not None and name.strip():
                updates.append("name = ?")
                params.append(name.strip())
            if dob is not None:
                updates.append("dob = ?")
                params.append(dob.strip())
            if id_number is not None:
                updates.append("id_number = ?")
                params.append(id_number.strip())
            if document_type is not None:
                updates.append("document_type = ?")
                params.append(document_type.strip())
            if address is not None:
                updates.append("address = ?")
                params.append(address.strip())
            if notes is not None:
                updates.append("notes = ?")
                params.append(notes.strip())

            if blood_group is not None:
                updates.append("blood_group = ?")
                params.append(blood_group.strip())
            if email is not None:
                updates.append("email = ?")
                params.append(email.strip())
            if phone is not None:
                updates.append("phone = ?")
                params.append(phone.strip())
            if relative_name is not None:
                updates.append("relative_name = ?")
                params.append(relative_name.strip())
            if relative_relation is not None:
                updates.append("relative_relation = ?")
                params.append(relative_relation.strip())
            if relative_other_explain is not None:
                updates.append("relative_other_explain = ?")
                params.append(relative_other_explain.strip())

            if custom_fields is not None:
                if isinstance(custom_fields, dict):
                    cf_str = json.dumps(custom_fields)
                elif isinstance(custom_fields, str):
                    cf_str = custom_fields
                else:
                    cf_str = '{}'
                updates.append("custom_fields_json = ?")
                params.append(cf_str)

            if updates:
                params.append(face_id)
                c.execute(f"UPDATE face_records SET {', '.join(updates)} WHERE id = ?", params)
                conn.commit()

            c.execute("SELECT * FROM face_records WHERE id = ?", (face_id,))
            updated_row = dict(c.fetchone())
            conn.close()

            cf = {}
            try:
                if updated_row.get('custom_fields_json'):
                    cf = json.loads(updated_row['custom_fields_json'])
            except Exception:
                pass
            updated_row['customFields'] = cf
            updated_row['bloodGroup'] = updated_row.get('blood_group') or ''
            updated_row['email'] = updated_row.get('email') or ''
            updated_row['phone'] = updated_row.get('phone') or ''
            updated_row['relativeName'] = updated_row.get('relative_name') or ''
            updated_row['relativeRelation'] = updated_row.get('relative_relation') or ''
            updated_row['relativeOtherExplain'] = updated_row.get('relative_other_explain') or ''
            return updated_row

    def merge_profiles(self, source_id, target_id):
        """
        Merge source_id profile into target_id profile.
        Transfers all photo embeddings, combines non-empty profile metadata,
        removes the duplicate source profile, and rebuilds FAISS index.
        """
        if int(source_id) == int(target_id):
            raise ValueError("Source profile and Target profile cannot be the same.")

        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()

            c.execute("SELECT * FROM face_records WHERE id = ?", (source_id,))
            src = c.fetchone()
            c.execute("SELECT * FROM face_records WHERE id = ?", (target_id,))
            tgt = c.fetchone()

            if not src:
                conn.close()
                raise ValueError(f"Source profile #{source_id} not found.")
            if not tgt:
                conn.close()
                raise ValueError(f"Target profile #{target_id} not found.")

            # 1. Transfer all embeddings to target profile
            c.execute("UPDATE face_profile_embeddings SET profile_id = ? WHERE profile_id = ?", (target_id, source_id))

            # 2. Merge missing metadata from source into target if target has blanks
            updates = []
            params = []
            for field in ['dob', 'address', 'id_number', 'document_type', 'notes',
                          'blood_group', 'email', 'phone', 'relative_name', 'relative_relation', 'relative_other_explain']:
                src_val = src[field] if field in src.keys() else ''
                tgt_val = tgt[field] if field in tgt.keys() else ''
                if (not tgt_val or tgt_val.strip() == '') and (src_val and src_val.strip() != ''):
                    updates.append(f"{field} = ?")
                    params.append(src_val.strip())

            # Merge custom fields JSON
            src_cf = {}
            tgt_cf = {}
            try:
                if 'custom_fields_json' in src.keys() and src['custom_fields_json']:
                    src_cf = json.loads(src['custom_fields_json'])
            except Exception:
                pass
            try:
                if 'custom_fields_json' in tgt.keys() and tgt['custom_fields_json']:
                    tgt_cf = json.loads(tgt['custom_fields_json'])
            except Exception:
                pass
            merged_cf = {**src_cf, **tgt_cf}
            if merged_cf:
                updates.append("custom_fields_json = ?")
                params.append(json.dumps(merged_cf))

            # 3. Update photo_count on target
            c.execute("SELECT COUNT(*) as cnt FROM face_profile_embeddings WHERE profile_id = ?", (target_id,))
            total_photos = c.fetchone()['cnt']
            updates.append("photo_count = ?")
            params.append(total_photos)

            params.append(target_id)
            c.execute(f"UPDATE face_records SET {', '.join(updates)} WHERE id = ?", params)

            # 4. Delete source profile from face_records
            c.execute("DELETE FROM face_records WHERE id = ?", (source_id,))
            conn.commit()

            c.execute("SELECT * FROM face_records WHERE id = ?", (target_id,))
            merged_target = dict(c.fetchone())
            conn.close()

            # 5. Rebuild FAISS index
            self._build_faiss_index()

            return {
                'sourceId': source_id,
                'targetId': target_id,
                'targetName': merged_target['name'],
                'photoCount': total_photos,
                'message': f"Successfully merged Profile #{source_id} ('{src['name']}') into Profile #{target_id} ('{merged_target['name']}'). Target profile now has {total_photos} photos."
            }

    def delete_face(self, face_id):
        """Delete a registered face and rebuild FAISS index."""
        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("DELETE FROM face_records WHERE id = ?", (face_id,))
            c.execute("DELETE FROM face_profile_embeddings WHERE profile_id = ?", (face_id,))
            deleted = c.rowcount > 0
            conn.commit()
            conn.close()

            if deleted:
                self._build_faiss_index()
            return deleted

    def get_stats(self):
        """Return face database statistics."""
        with self.lock:
            conn = self._get_conn()
            c = conn.cursor()
            c.execute("SELECT COUNT(*) as count FROM face_records")
            row = c.fetchone()
            count = row['count'] if row else 0
            conn.close()
            return {
                'totalFaces': count,
                'faissReady': _FAISS_AVAILABLE and self.faiss_index is not None,
                'faissVectors': self.faiss_index.ntotal if (self.faiss_index is not None) else 0,
                'vectorDimension': 128,
                'engine': 'FAISS + Rust (Rayon SIMD)'
            }


# Singleton accessor
def get_face_db():
    return FaceDatabase()
