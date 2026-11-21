#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed Dummy Face Biometric Database
Fetches fictional test portrait images and biographical data, extracts YuNet + SFace 128D embeddings,
and enrolls complete fictitious test identities into SQLite and FAISS.
"""

import os
import sys
import json
import base64
import random
import time
import urllib.request
from PIL import Image
import io
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from modules.face_database import FaceDatabase, get_face_db
from modules.face_service import analyze_face_image

ROLES = [
    "Cyber Defense Analyst",
    "Neural Network Researcher",
    "Field Intelligence Operative",
    "Satellite Imagery Analyst",
    "Cryptographic Systems Engineer",
    "Zero-Trust Security Architect",
    "Biometric Forensics Specialist",
    "Robotics & Sensor Engineer",
    "Communications Security Officer",
    "Tactical Operations Coordinator",
    "Data Privacy & Compliance Auditor",
    "Autonomous Systems Operator"
]

CLEARANCES = ["Level 1 (Confidential)", "Level 2 (Secret)", "Level 3 (Top Secret / SCI)", "Operational Clearance"]
DIVISIONS = ["Cyber Command", "Tactical Reconnaissance", "Neural Systems Lab", "Signals Intelligence", "Field Operations"]
BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-"]
DOC_TYPES = ["Passport", "Driver License", "National Identity Card", "Security Clearance ID"]

RELATIONSHIPS = ["Spouse", "Father", "Mother", "Brother", "Sister"]


def fetch_dummy_profiles(count=30):
    url = f"https://randomuser.me/api/?results={count}&inc=gender,name,location,email,dob,phone,cell,id,picture,nat&nat=us,gb,ca,au,fr,de"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get("results", [])
    except Exception as e:
        print(f"[Seed] Failed to fetch from randomuser API ({e}), using portrait fallback generator...")
        return []


def download_image(url):
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.read()
    except Exception as e:
        print(f"[Seed] Error downloading image from {url}: {e}")
        return None


def main():
    print("=" * 65)
    print("  SEEDING CLEAN DUMMY FACE DATABASE (TEST / DEMO PURPOSES)")
    print("=" * 65)

    db = get_face_db()
    # Force re-init table schema in case it was empty
    db._init_sqlite()

    # Clear any residual records in face_database.db
    with db.lock:
        conn = db._get_conn()
        conn.execute("DELETE FROM face_profile_embeddings")
        conn.execute("DELETE FROM face_records")
        conn.commit()

    print("[Seed] Existing tables cleared. Fetching fictional dummy profiles...")
    profiles = fetch_dummy_profiles(30)

    # Fallback list of fictional names if API failed
    if not profiles:
        first_names = ["Marcus", "Elena", "Liam", "Sofia", "Kaito", "Amara", "David", "Zara", "Lucas", "Maya",
                       "Alexander", "Chloe", "Julian", "Aria", "Ethan", "Nadia", "Gabriel", "Leila", "Victor", "Freja"]
        last_names = ["Vance", "Rostova", "O'Connor", "Rodriguez", "Tanaka", "Okafor", "Chen", "Al-Mansoor", "Meyer",
                      "Patel", "Stone", "Dubois", "Mercer", "Novak", "Kovacs", "Sinclair", "Sterling", "Hayek", "Winter", "Berg"]
        profiles = []
        for i in range(25):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            gender = "men" if i % 2 == 0 else "women"
            idx = (i % 40) + 1
            profiles.append({
                "gender": "male" if gender == "men" else "female",
                "name": {"first": fn, "last": ln},
                "location": {"street": {"number": 100 + i, "name": "Cyber Way"}, "city": "Neo Metropolis", "country": "United States"},
                "email": f"{fn.lower()}.{ln.lower()}@demo-intel.test",
                "dob": {"date": f"19{random.randint(75, 99)}-0{random.randint(1, 9)}-{random.randint(10, 28)}T00:00:00.000Z"},
                "phone": f"+1-555-01{i:02d}",
                "picture": {"large": f"https://randomuser.me/api/portraits/{gender}/{idx}.jpg"}
            })

    enrolled_count = 0
    multi_photo_targets = [1, 3, 5, 8]  # add second photo variation for these

    for idx, p in enumerate(profiles):
        first = p.get("name", {}).get("first", "John")
        last = p.get("name", {}).get("last", "Doe")
        full_name = f"{first} {last}"
        gender = p.get("gender", "male")
        img_url = p.get("picture", {}).get("large") or f"https://randomuser.me/api/portraits/{'men' if gender == 'male' else 'women'}/{idx + 1}.jpg"

        print(f"[{idx+1}/{len(profiles)}] Enrolling: {full_name}...")
        img_bytes = download_image(img_url)
        if not img_bytes:
            continue

        # Run face detector & 128D embedder
        try:
            analysis = analyze_face_image(img_bytes)
        except Exception as err:
            print(f"    Error analyzing image: {err}")
            continue

        faces = analysis.get("faces", [])
        if not faces:
            # Fallback: create random normalized 128D vector if face detection missed tiny crop
            vec = np.random.randn(128).astype(np.float32)
            vec = (vec / np.linalg.norm(vec)).tolist()
            b64_thumb = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode('utf-8')
        else:
            vec = faces[0]["embedding"]
            b64_thumb = faces[0].get("thumbnail") or ("data:image/jpeg;base64," + base64.b64encode(img_bytes).decode('utf-8'))

        dob_raw = p.get("dob", {}).get("date", "1990-01-01T00:00:00")
        dob_str = dob_raw.split("T")[0] if "T" in dob_raw else dob_raw
        doc_type = random.choice(DOC_TYPES)
        id_prefix = "P-" if "Passport" in doc_type else ("DL-" if "Driver" in doc_type else "ID-")
        id_num = f"{id_prefix}{random.randint(1000000, 9999999)}"
        blood = random.choice(BLOOD_GROUPS)
        role = random.choice(ROLES)
        clearance = random.choice(CLEARANCES)
        division = random.choice(DIVISIONS)

        loc = p.get("location", {})
        street = loc.get("street", {})
        st_name = street.get("name", "Broadway") if isinstance(street, dict) else "Main St"
        st_num = street.get("number", 101) if isinstance(street, dict) else 101
        city = loc.get("city", "District 1")
        country = loc.get("country", "Global")
        address = f"{st_num} {st_name}, {city}, {country}"

        email = p.get("email", f"{first.lower()}.{last.lower()}@tactical.demo")
        phone = p.get("phone", "+1 (555) 019-2834")
        rel_relation = random.choice(RELATIONSHIPS)
        rel_name = f"{random.choice(['John', 'Mary', 'Robert', 'Patricia', 'James', 'Linda'])} {last}"

        custom_fields = {
            "Clearance": clearance,
            "Division": division,
            "Specialization": role,
            "Status": "Active Operative"
        }

        try:
            profile_id = db.add_face(
                name=full_name,
                embedding=vec,
                thumbnail=b64_thumb,
                notes=f"Fictional Test Profile — {role} ({clearance})",
                dob=dob_str,
                address=address,
                id_number=id_num,
                document_type=doc_type,
                blood_group=blood,
                email=email,
                phone=phone,
                relative_name=rel_name,
                relative_relation=rel_relation,
                custom_fields=custom_fields
            )
            enrolled_count += 1
            print(f"    ✔ Registered ID #{profile_id}: {full_name} ({id_num})")

            # Check if this profile gets a secondary photo variation
            if idx in multi_photo_targets:
                var_gender = "men" if gender == "male" else "women"
                var_idx = (idx + 45) % 90 + 1
                var_url = f"https://randomuser.me/api/portraits/{var_gender}/{var_idx}.jpg"
                var_bytes = download_image(var_url)
                if var_bytes:
                    try:
                        v_analysis = analyze_face_image(var_bytes)
                        if v_analysis.get("faces"):
                            v_vec = v_analysis["faces"][0]["embedding"]
                            v_thumb = v_analysis["faces"][0].get("thumbnail") or ("data:image/jpeg;base64," + base64.b64encode(var_bytes).decode('utf-8'))
                            db.add_embedding_to_profile(profile_id, v_vec, thumbnail=v_thumb)
                            print(f"    ✔ Added 2nd angle variation to profile #{profile_id}")
                    except Exception as ve:
                        pass

        except Exception as e:
            print(f"    Failed to add profile: {e}")

    # Re-build and save FAISS index
    db._build_faiss_index()

    print("=" * 65)
    print(f"  SEED COMPLETE! Enrolled {enrolled_count} dummy identities.")
    print("=" * 65)


if __name__ == "__main__":
    main()

