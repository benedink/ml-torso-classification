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

def xyxy_to_box(x1, y1, x2, y2):
    """Convert xyxy coordinates to frontend-friendly x/y/width/height."""
    return {
        "x": int(x1),
        "y": int(y1),
        "width": int(max(0, x2 - x1)),
        "height": int(max(0, y2 - y1))
    }

def roboflow_pred_to_xyxy(pred):
    """Convert a Roboflow prediction to xyxy coordinates."""
    x1 = int(pred['x'] - pred['width'] / 2)
    y1 = int(pred['y'] - pred['height'] / 2)
    x2 = int(pred['x'] + pred['width'] / 2)
    y2 = int(pred['y'] + pred['height'] / 2)
    return [x1, y1, x2, y2]

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
        matched_box = None
        for (bbox, text, prob) in text_results:
            if prob > 0.40 and len(text) >= 3:
                found_text.append(text.lower())
                best_prob = max(best_prob, float(prob))

        if len(found_text) > 0:
            full_detected_string = " ".join(found_text)
            matched_keywords = [kw for kw in VALID_ORG_KEYWORDS if kw in full_detected_string]

            if len(matched_keywords) > 0:
                for (bbox, text, prob) in text_results:
                    lowered = text.lower()
                    if prob > 0.40 and any(kw in lowered for kw in matched_keywords):
                        xs = [point[0] for point in bbox]
                        ys = [point[1] for point in bbox]
                        matched_box = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
                        break
                return True, matched_keywords[0].upper(), best_prob, matched_box
            
        return False, "No Match", 0.0, None
    except Exception as e:
        print(f"OCR Error: {e}")
        return False, "Error", 0.0, None

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

def add_detection(results, res_obj, status):
    """Store a detection in both grouped and unified response lists."""
    results["detections"].append(res_obj)
    if status == "ALLOWED":
        results["allowed"].append(res_obj)
    else:
        results["not_allowed"].append(res_obj)

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
            return jsonify({"detections": [], "allowed": [], "not_allowed": [], "message": "No people detected"})

        # Get Roboflow predictions for entire frame
        roboflow_preds = []
        try:
            temp_img_path = "temp_frame.jpg"
            cv2.imwrite(temp_img_path, img_array)
            full_pred = shape_model.predict(temp_img_path, confidence=40).json()
            roboflow_preds = full_pred.get('predictions', [])
        except Exception as e:
            print(f"Roboflow shape model call failed: {e}")

        results = {"detections": [], "allowed": [], "not_allowed": []}

        for person in people:
            try:
                idx = person["person_index"]
                bbox = person["torso_box"]
                tx1, ty1, tx2, ty2 = bbox
                torso_crop = img_array[ty1:ty2, tx1:tx2]

                if torso_crop.size == 0: continue

                # 1. Roboflow Shape Class (Stage 2)
                rf_class = "unknown"
                rf_conf = 0.0
                best_iou = 0.0
                for pred in roboflow_preds:
                    pred_box = roboflow_pred_to_xyxy(pred)
                    iou = calculate_iou([tx1, ty1, tx2, ty2], pred_box)
                    if iou > best_iou:
                        best_iou = iou
                        rf_class = pred['class']
                        rf_conf = float(pred['confidence'])

                # STRICT RULE: Shape rejection takes priority (Stage 2)
                garment_box = xyxy_to_box(tx1, ty1, tx2, ty2)
                evidence_boxes = [{
                    "type": "garment",
                    "label": f"Garment: {rf_class.upper()}" if rf_class != "unknown" else "Garment Region",
                    "confidence": round(max(rf_conf, 0.0), 2),
                    "box": garment_box
                }]

                if rf_class in ["dress", "sleeveless", "violation"]:
                    res_obj = {
                        "person_index": idx,
                        "status": "NOT ALLOWED",
                        "stage": "Stage 2",
                        "reason": f"Shape Violation: {rf_class.upper()}",
                        "confidence": round(rf_conf, 2),
                        "type": "shape",
                        "boundingBox": garment_box,
                        "evidenceBoxes": evidence_boxes,
                        "details": {
                            "roboflow_class": rf_class,
                            "roboflow_conf": round(rf_conf, 2),
                            "classification_source": "Roboflow garment-shape model",
                            "confidence_source": "Roboflow garment confidence"
                        }
                    }
                    add_detection(results, res_obj, "NOT ALLOWED")
                    continue

                # 2. YOLO Logo Detection (Stage 3)
                has_logo = False
                logo_conf = 0.0
                logo_boxes = []
                try:
                    logo_results = logo_model(torso_crop, verbose=False, conf=0.5)
                    if len(logo_results[0].boxes) > 0:
                        has_logo = True
                        for box_idx, box in enumerate(logo_results[0].boxes.xyxy):
                            lx1, ly1, lx2, ly2 = map(int, box.tolist())
                            abs_box = xyxy_to_box(tx1 + lx1, ty1 + ly1, tx1 + lx2, ty1 + ly2)
                            conf_val = float(logo_results[0].boxes.conf[box_idx])
                            logo_conf = max(logo_conf, conf_val)
                            logo_boxes.append({
                                "type": "logo",
                                "label": "Detected Logo",
                                "confidence": round(conf_val, 2),
                                "box": abs_box
                            })
                except Exception as e:
                    print(f"Logo detection error: {e}")
                evidence_boxes.extend(logo_boxes)

                # 3. EasyOCR Check (Stage 3)
                is_org, org_text, ocr_conf, ocr_box = check_org_shirt_ocr(torso_crop)
                if ocr_box is not None:
                    ox1, oy1, ox2, oy2 = ocr_box
                    evidence_boxes.append({
                        "type": "org_text",
                        "label": f"Org Text: {org_text}",
                        "confidence": round(ocr_conf, 2),
                        "box": xyxy_to_box(tx1 + ox1, ty1 + oy1, tx1 + ox2, ty1 + oy2)
                    })

                # 4. Saturation/Brightness Check (Stage 4)
                hsv_crop = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2HSV)
                avg_saturation = np.mean(hsv_crop[:, :, 1])
                avg_brightness = np.mean(hsv_crop[:, :, 2])
                is_dark_garment = (avg_brightness < 80) or (avg_saturation < 30 and avg_brightness < 120)

                # 5. CLIP Analysis (Stage 4)
                clip_label, clip_conf = run_clip_analysis(torso_crop)

                # 6. White pixel majority (Stage 4)
                is_white, white_ratio = check_white_majority(torso_crop)

                # DECISION LOGIC
                status = "NOT ALLOWED"
                reason = "Civilian Shirt"
                final_confidence = clip_conf
                current_stage = "Stage 4"
                classification_type = "civilian_shirt"
                classification_source = "CLIP garment analysis"
                
                if has_logo:
                    status = "ALLOWED"
                    reason = "Logo Detected"
                    final_confidence = logo_conf
                    current_stage = "Stage 3"
                    classification_type = "logo"
                    classification_source = "YOLO logo detector"
                elif is_org:
                    status = "ALLOWED"
                    reason = f"Valid Org Text: {org_text}"
                    final_confidence = ocr_conf
                    current_stage = "Stage 3"
                    classification_type = "org_text"
                    classification_source = "EasyOCR organization text match"
                elif is_dark_garment:
                    status = "NOT ALLOWED"
                    reason = "Prohibited Dark Garment"
                    final_confidence = 0.9
                    current_stage = "Stage 4"
                    classification_type = "dark_garment"
                    classification_source = "Brightness and saturation check"
                elif rf_class == "white" or "white" in clip_label:
                    if is_white:
                        status = "ALLOWED"
                        reason = "White Uniform Verified"
                        final_confidence = max(rf_conf, clip_conf, white_ratio)
                        current_stage = "Stage 4"
                        classification_type = "white_uniform"
                        classification_source = "White-pixel verification with CLIP/Roboflow support"
                    else:
                        status = "NOT ALLOWED"
                        reason = "Garment not white enough"
                        final_confidence = 1.0 - white_ratio
                        current_stage = "Stage 4"
                        classification_type = "not_white_enough"
                        classification_source = "White-pixel verification"

                res_obj = {
                    "person_index": idx,
                    "status": status,
                    "stage": current_stage,
                    "reason": reason,
                    "confidence": round(final_confidence, 2),
                    "type": classification_type,
                    "boundingBox": garment_box,
                    "evidenceBoxes": evidence_boxes,
                    "details": {
                        "has_logo": has_logo,
                        "logo_conf": round(logo_conf, 2),
                        "ocr_match": is_org,
                        "ocr_conf": round(ocr_conf, 2),
                        "clip_label": clip_label,
                        "clip_conf": round(clip_conf, 2),
                        "roboflow_class": rf_class,
                        "roboflow_conf": round(rf_conf, 2),
                        "white_ratio": round(white_ratio, 2),
                        "classification_source": classification_source,
                        "confidence_source": {
                            "logo": "Highest detected logo confidence",
                            "org_text": "OCR text match confidence",
                            "dark_garment": "Rule-based confidence from dark-garment heuristic",
                            "white_uniform": "Best supporting signal from Roboflow, CLIP, and white-ratio checks",
                            "not_white_enough": "Inverse white-ratio score",
                            "civilian_shirt": "CLIP garment classification confidence"
                        }.get(classification_type, "Mixed pipeline confidence")
                    }
                }


                add_detection(results, res_obj, status)
            except Exception as e:
                print(f"Error processing person {person.get('person_index')}: {e}")
                res_obj = {
                    "person_index": person.get("person_index", 0),
                    "status": "NOT ALLOWED",
                    "stage": "Exception",
                    "reason": "Detection processing failed for this person",
                    "confidence": 0.0,
                    "type": "processing_error",
                    "boundingBox": xyxy_to_box(*person.get("torso_box", [0, 0, 0, 0])),
                    "evidenceBoxes": [],
                    "details": {
                        "classification_source": "Backend exception fallback",
                        "confidence_source": "No valid confidence available"
                    }
                }
                add_detection(results, res_obj, "NOT ALLOWED")

        return jsonify(results)

    except Exception as e:
        print(f"Global Pipeline Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
