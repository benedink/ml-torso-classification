"""
Flask backend for School Uniform Compliance Detection
Integrates YOLOv8, Roboflow, EasyOCR, CLIP, and Logo Detection
"""

import os
import cv2
import numpy as np
import torch
import json
import base64
from io import BytesIO
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from roboflow import Roboflow
import easyocr
from transformers import CLIPProcessor, CLIPModel

app = Flask(__name__)
CORS(app)

# Configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

# ============================================================================
# MODEL INITIALIZATION (LOADED ONCE AT STARTUP)
# ============================================================================

# 1. Pose Model (YOLOv8)
pose_model = YOLO('backend/models/yolov8s-pose.pt')
print("✓ Pose model loaded")

# 2. Roboflow Garment Shape Classifier
rf = Roboflow(api_key="1B55dyDPg4h1jHZmR6cs")
project = rf.workspace("gc-ka-soho").project("garment-dsp")
shape_model = project.version(4).model
print("✓ Roboflow shape model loaded")

# 3. EasyOCR Reader
ocr_reader = easyocr.Reader(['en'], gpu=(DEVICE == "cuda"))
print("✓ EasyOCR reader loaded")

# 4. CLIP Model and Processor
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch16").to(DEVICE)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch16")
print("✓ CLIP model loaded")

# 5. Logo Detector (YOLOv8)
logo_model = YOLO('backend/models/best.pt')
print("✓ Logo model loaded")

# ============================================================================
# VALIDATION DATA
# ============================================================================

VALID_ORG_KEYWORDS = [
    "batangas", "batstateu", "alangilan", "spartan", "spartans", "neu", "bsu",
    "jiecep", "jpiche", "cafad", "ashrae", "psse", "aces", "kalinga", "jpiie",
    "papagayo", "aices", "mexess", "focus", "thema", "dost", "sei", "mabini",
    "engineering", "engineers", "electronics", "chemical", "architecture",
    "architects", "informatics", "computing", "sanitary", "mechanical", "computer",
    "civil", "industrial", "instrumentation", "mechatronics", "geological",
    "biomedical", "interior design", "naval", "marine", "petrophysicists",
    "agriculturists", "geodetic", "information technology", "cs", "computer science",
    "emerge", "esports", "red cross", "youth", "fine arts", "heating", "refrigerating",
    "university", "college", "council", "institute", "society", "association",
    "organization", "chapter", "scholars", "auxiliary", "alliance", "tc", "volunteers"
]

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def calculate_iou(box1, box2):
    """Calculate Intersection over Union for two bounding boxes."""
    x_left = max(box1[0], box2[0])
    y_top = max(box1[1], box2[1])
    x_right = min(box1[2], box2[2])
    y_bottom = min(box1[3], box2[3])

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection = (x_right - x_left) * (y_bottom - y_top)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

    return intersection / float(area1 + area2 - intersection)

def extract_torso_boxes(img_array):
    """Extract torso bounding boxes using keypoints."""
    try:
        results = pose_model(img_array, verbose=False)
        raw_people_data = []
        img_h, img_w = img_array.shape[:2]

        for idx, person in enumerate(results[0]):
            x1, y1, x2, y2 = map(int, person.boxes.xyxy[0])
            torso_box = [max(0, x1), max(0, y1), min(img_w, x2), min(img_h, y2)]

            if person.keypoints is not None and person.keypoints.conf is not None:
                kpts = person.keypoints.xy[0].cpu().numpy()
                conf = person.keypoints.conf[0].cpu().numpy()
                target_idx = [5, 6, 11, 12] # shoulders and hips

                if all(conf[i] > 0.5 for i in target_idx):
                    xs, ys = [kpts[i][0] for i in target_idx], [kpts[i][1] for i in target_idx]
                    tx1, tx2, ty1, ty2 = min(xs), max(xs), min(ys), max(ys)
                    px, py = (tx2 - tx1) * 0.15, (ty2 - ty1) * 0.15

                    nx1, ny1 = max(0, int(tx1 - px)), max(0, int(ty1 - py))
                    nx2, ny2 = min(img_w, int(tx2 + px)), min(img_h, int(ty2 + py))
                    torso_box = [nx1, ny1, nx2, ny2]

            raw_people_data.append({"person_index": idx, "torso_box": torso_box})

        # Filter ghost boxes
        filtered_people = []
        for new_person in raw_people_data:
            is_duplicate = False
            for saved_person in filtered_people:
                iou = calculate_iou(new_person["torso_box"], saved_person["torso_box"])
                if iou > 0.40:
                    is_duplicate = True
                    break
            if not is_duplicate:
                filtered_people.append(new_person)

        for i, p in enumerate(filtered_people):
            p["person_index"] = i

        return filtered_people
    except Exception as e:
        print(f"Torso Extraction Error: {e}")
        return []

def run_clip_analysis(crop_img):
    """Analyze garment using CLIP model."""
    try:
        labels = ["a student in a white school uniform", "a student in a colored shirt", "a person in civilian clothing"]
        inputs = clip_processor(text=labels, images=Image.fromarray(cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)), return_tensors="pt", padding=True).to(DEVICE)
        
        with torch.no_grad():
            outputs = clip_model(**inputs)
        
        probs = outputs.logits_per_image.softmax(dim=1)
        conf, idx = torch.max(probs, dim=1)
        return labels[idx.item()], float(conf.item())
    except Exception as e:
        print(f"CLIP Analysis Error: {e}")
        return "unknown", 0.0

def check_org_shirt_ocr(crop_img):
    """Check if shirt contains valid organization text via EasyOCR."""
    try:
        rgb_crop = cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB)
        text_results = ocr_reader.readtext(rgb_crop)

        found_text = []
        best_prob = 0.0
        for (bbox, text, prob) in text_results:
            if prob > 0.40 and len(text) >= 3:
                found_text.append(text.lower())
                best_prob = max(best_prob, float(prob))

        if len(found_text) > 0:
            full_detected_string = " ".join(found_text)
            matched_keywords = [kw for kw in VALID_ORG_KEYWORDS if kw in full_detected_string]

            if len(matched_keywords) > 0:
                return True, matched_keywords[0].upper(), best_prob
            
        return False, "No Match", 0.0
    except Exception as e:
        print(f"OCR Error: {e}")
        return False, "Error", 0.0

def check_white_majority(crop_img):
    """Check if torso is predominantly white with strict 50% threshold."""
    try:
        if crop_img.size == 0:
            return False, 0.0

        result = crop_img.astype(np.float32)

        avg_b = np.mean(result[:, :, 0]) + 1e-5
        avg_g = np.mean(result[:, :, 1]) + 1e-5
        avg_r = np.mean(result[:, :, 2]) + 1e-5
        avg_gray = (avg_b + avg_g + avg_r) / 3

        result[:, :, 0] *= (avg_gray / avg_b)
        result[:, :, 1] *= (avg_gray / avg_g)
        result[:, :, 2] *= (avg_gray / avg_r)

        result = np.clip(result, 0, 255).astype(np.uint8)
        hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)

        white_mask = (hsv[:, :, 1] < 60) & (hsv[:, :, 2] > 140)
        white_ratio = np.sum(white_mask) / white_mask.size

        return white_ratio > 0.50, float(white_ratio)
    except Exception as e:
        print(f"White Check Error: {e}")
        return False, 0.0

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "device": DEVICE,
        "models_loaded": ["YOLO Pose", "Roboflow Shape", "EasyOCR", "CLIP", "YOLO Logo"]
    })

@app.route('/api/detect', methods=['POST'])
def detect():
    """
    Detection pipeline using 5 models with strict compliance rules.
    Hardened against crashes and providing real confidence scores.
    """
    try:
        data = request.get_json()
        image_base64 = data.get('image')

        if not image_base64:
            return jsonify({"error": "No image provided"}), 400

        # Decode base64 image
        image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        img_array = cv2.imdecode(np.frombuffer(image_data, np.uint8), cv2.IMREAD_COLOR)

        if img_array is None:
            return jsonify({"error": "Invalid image"}), 400

        # 1. Pose Detection (Mandatory)
        people = extract_torso_boxes(img_array)

        if len(people) == 0:
            return jsonify({"allowed": [], "not_allowed": [], "message": "No people detected"})

        # Get Roboflow predictions for entire frame
        roboflow_preds = []
        try:
            temp_img_path = "temp_frame.jpg"
            cv2.imwrite(temp_img_path, img_array)
            full_pred = shape_model.predict(temp_img_path, confidence=40).json()
            roboflow_preds = full_pred.get('predictions', [])
        except Exception as e:
            print(f"Roboflow shape model call failed: {e}")

        results = {"allowed": [], "not_allowed": []}

        for person in people:
            try:
                idx = person["person_index"]
                bbox = person["torso_box"]
                tx1, ty1, tx2, ty2 = bbox
                torso_crop = img_array[ty1:ty2, tx1:tx2]

                if torso_crop.size == 0: continue

                # 1. Roboflow Shape Class
                rf_class = "unknown"
                rf_conf = 0.0
                person_center = ((tx1 + tx2) / 2, (ty1 + ty2) / 2)
                for pred in roboflow_preds:
                    vx1, vy1 = int(pred['x'] - pred['width']/2), int(pred['y'] - pred['height']/2)
                    vx2, vy2 = int(pred['x'] + pred['width']/2), int(pred['y'] + pred['height']/2)
                    if vx1 <= person_center[0] <= vx2 and vy1 <= person_center[1] <= vy2:
                        rf_class = pred['class']
                        rf_conf = float(pred['confidence'])
                        break

                # STRICT RULE: Shape rejection takes priority
                if rf_class in ["dress", "sleeveless", "violation"]:
                    results["not_allowed"].append({
                        "person_index": idx,
                        "stage": "Shape Check",
                        "reason": f"Shape Violation: {rf_class.upper()}",
                        "confidence": round(rf_conf, 2),
                        "details": {"roboflow_class": rf_class}
                    })
                    continue

                # 2. YOLO Logo Detection
                has_logo = False
                logo_conf = 0.0
                try:
                    logo_results = logo_model(torso_crop, verbose=False, conf=0.5)
                    if len(logo_results[0].boxes) > 0:
                        has_logo = True
                        logo_conf = float(logo_results[0].boxes.conf[0])
                except Exception as e:
                    print(f"Logo detection error: {e}")

                # 3. EasyOCR Check
                is_org, org_text, ocr_conf = check_org_shirt_ocr(torso_crop)

                # 4. Saturation/Brightness Check
                hsv_crop = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2HSV)
                avg_saturation = np.mean(hsv_crop[:, :, 1])
                avg_brightness = np.mean(hsv_crop[:, :, 2])
                is_dark_garment = (avg_brightness < 80) or (avg_saturation < 30 and avg_brightness < 120)

                # 5. CLIP Analysis
                clip_label, clip_conf = run_clip_analysis(torso_crop)

                # 6. White pixel majority
                is_white, white_ratio = check_white_majority(torso_crop)

                # DECISION LOGIC
                status = "NOT ALLOWED"
                reason = "Civilian Shirt"
                final_confidence = clip_conf
                
                if has_logo:
                    status = "ALLOWED"
                    reason = "Official Logo Detected"
                    final_confidence = logo_conf
                elif is_org:
                    status = "ALLOWED"
                    reason = f"Org Text: {org_text}"
                    final_confidence = ocr_conf
                elif is_dark_garment:
                    status = "NOT ALLOWED"
                    reason = "Prohibited Dark/Non-Uniform Garment"
                    final_confidence = 0.9  # High confidence it's dark
                elif rf_class == "white" or "white" in clip_label:
                    if is_white:
                        status = "ALLOWED"
                        reason = "White Uniform Verified"
                        final_confidence = max(rf_conf, clip_conf, white_ratio)
                    else:
                        status = "NOT ALLOWED"
                        reason = "Garment not white enough"
                        final_confidence = 1.0 - white_ratio

                res_obj = {
                    "person_index": idx,
                    "stage": "Comprehensive Analysis",
                    "reason": reason,
                    "confidence": round(final_confidence, 2),
                    "details": {
                        "has_logo": has_logo,
                        "logo_conf": round(logo_conf, 2),
                        "ocr_match": is_org,
                        "ocr_conf": round(ocr_conf, 2),
                        "clip_label": clip_label,
                        "clip_conf": round(clip_conf, 2),
                        "roboflow_class": rf_class,
                        "roboflow_conf": round(rf_conf, 2),
                        "white_ratio": round(white_ratio, 2)
                    }
                }

                if status == "ALLOWED":
                    results["allowed"].append(res_obj)
                else:
                    results["not_allowed"].append(res_obj)
            except Exception as e:
                print(f"Error processing person {person.get('person_index')}: {e}")
                results["not_allowed"].append({
                    "person_index": person.get("person_index", 0),
                    "stage": "Exception",
                    "reason": "Civilian Shirt",
                    "confidence": 0.5
                })

        return jsonify(results)

    except Exception as e:
        print(f"Global Pipeline Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
