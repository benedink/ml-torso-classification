# Backend Setup Guide

The backend runs the actual ML models (YOLOv8, Roboflow, EasyOCR, CLIP) for uniform detection.

## Prerequisites

- Python 3.8+
- CUDA 11.8+ (optional, for GPU acceleration)
- 8GB+ RAM (16GB recommended for GPU models)

## Installation

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

This will install:

- Flask & Flask-CORS
- YOLOv8 (pose detection)
- Roboflow (garment shape classifier)
- EasyOCR (text detection)
- PyTorch & TorchVision
- OpenCV
- And more...

**Note:** First install will take 5-15 minutes depending on your internet speed and system.

### 3. Run Backend Server

```bash
python app.py
```

You should see output like:

```
Using device: cuda (or cpu)
✓ Pose model loaded
✓ Roboflow shape model loaded
✓ OCR reader loaded
 * Running on http://0.0.0.0:5000
```

## API Endpoints

### Health Check

```bash
curl http://localhost:5000/api/health
```

Response:

```json
{
  "status": "ok",
  "device": "cuda",
  "models": {
    "pose": "yolov8s-pose.pt",
    "shape": "roboflow-garment-dsp",
    "ocr": "easyocr"
  }
}
```

### Image Detection

**POST** `/api/detect`

Request:

```json
{
  "image": "data:image/jpeg;base64,..." // base64 encoded image
}
```

Response:

```json
{
  "allowed": [
    {
      "person_index": 0,
      "stage": "Stage 1",
      "reason": "Roboflow detected: white shirt",
      "confidence": 0.95
    }
  ],
  "not_allowed": [
    {
      "person_index": 1,
      "stage": "Stage 4",
      "reason": "Civilian Shirt (Failed all checks)",
      "confidence": 0.65
    }
  ]
}
```

## Frontend Configuration

The React app connects to the backend via the `VITE_API_URL` environment variable:

```bash
# .env.local
VITE_API_URL=http://localhost:5000
```

If not set, defaults to `http://localhost:5000`.

## Model Details

### Layer 1: YOLOv8 Pose Detection

- Detects humans and extracts torso bounding boxes
- Filters ghost boxes (duplicate detections)

### Layer 2: Roboflow Garment Shape

- Classifies garment type: white, PE uniform, dress, sleeveless, violation
- Direct pass for white shirts

### Layer 3: EasyOCR Text Detection

- Scans for organization text on uniform
- Validates against BatStateU whitelist

### Layer 4: White Balance Fallback

- Neutralizes stage lighting color cast
- Detects predominantly white garments

## Troubleshooting

### Models not loading?

```bash
python -c "from ultralytics import YOLO; YOLO('yolov8s-pose.pt')"
```

### Roboflow API Key Error?

- Check `app.py` has correct API key
- Ensure internet connection for model download

### CUDA/GPU Issues?

```bash
# Force CPU mode:
python app.py  # Will auto-detect and use CPU
```

### Port Already in Use?

```bash
# Change port in app.py:
app.run(host='0.0.0.0', port=5001, debug=True)
```

## Performance Notes

- **GPU**: ~50-200ms per frame (3-10 FPS for continuous detection)
- **CPU**: ~500ms-2s per frame (0.5-1 FPS)
- Detection runs every 3 seconds in live camera mode to balance accuracy/performance

## Production Deployment

For production, use a WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

Or use Docker:

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app.py .
CMD ["python", "app.py"]
```
