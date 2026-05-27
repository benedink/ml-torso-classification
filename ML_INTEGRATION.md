# ML Model Integration Summary

Your Camera Live Feed UI now includes the full multi-layer classification system from the Jupyter notebook.

## What Got Integrated

### Backend ML Pipeline (`backend/app.py`)

✅ **YOLOv8 Pose Detection** - Extracts torso bounding boxes and filters ghost boxes  
✅ **Roboflow Garment Classifier** - Detects white shirts, PE uniforms, dresses  
✅ **EasyOCR Text Scanner** - Reads organization text on uniforms  
✅ **White Balance Analysis** - Neutralizes stage lighting and detects white garments  
✅ **Validation System** - Checks against BatStateU organization keywords

### Frontend Changes

**ImageUpload.tsx**

- Replaced mock detection with real API calls
- Sends images to backend `/api/detect` endpoint
- Falls back to mock if API unavailable

**CameraFeed.tsx**

- Sends video frames to backend every 3 seconds (when detection active)
- Receives real classification results with confidence scores
- Falls back to mock if API unavailable

**App.tsx**

- localStorage persistence still works
- All detection results saved (both real and fallback)

## Quick Start (5 minutes)

### Option 1: Run Both (Easy)

**Windows:**

```bash
start.bat
```

**macOS/Linux:**

```bash
chmod +x start.sh
./start.sh
```

This opens both servers automatically.

### Option 2: Manual Setup

**Terminal 1 (Backend):**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python app.py
```

**Terminal 2 (Frontend):**

```bash
npm install
npm run dev
```

## What Happens Now

1. **User uploads image** → Sent to backend as base64
2. **Backend processes** → YOLOv8 detects people → Roboflow classifies garments → EasyOCR reads text
3. **Response sent** → Allowed/not_allowed classification with stage & confidence
4. **Result stored** → localStorage persists, UI updates instantly

## API Example

```bash
# Test backend health
curl http://localhost:5000/api/health

# Send image for detection
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

## Detection Stages

```
Stage 1: Roboflow Shape Detection
├─ White shirt → PASS
└─ Other shape → Continue

Stage 2: EasyOCR Organization Text
├─ Valid org text → PASS
└─ No text → Continue

Stage 3: White Balance Fallback
├─ Predominantly white → PASS
└─ Colored → REJECT

Final: Civilian Clothing (Failed all checks)
```

## File Structure

```
backend/
├── app.py                 ← Main Flask server with 4-layer detection
├── requirements.txt       ← Python dependencies
├── README.md             ← Detailed backend setup guide
├── test_backend.py       ← Test script to verify setup
└── .gitignore           ← Excludes large model files

src/
├── app/components/
│   ├── CameraFeed.tsx    ← Now calls /api/detect for frames
│   ├── ImageUpload.tsx   ← Now calls /api/detect for uploads
│   ├── DetectionStatusPanel.tsx
│   └── DetectionResults.tsx

.env.local               ← VITE_API_URL=http://localhost:5000
start.bat              ← One-click startup (Windows)
start.sh               ← One-click startup (macOS/Linux)
SETUP.md              ← Full documentation
```

## Verification Steps

### 1. Check Backend Status

```bash
curl http://localhost:5000/api/health
# Should return: {"status": "ok", "device": "cuda", "models": {...}}
```

### 2. Test with Sample Image

```bash
python backend/test_backend.py path/to/image.jpg
# Should show: ✓ All tests passed! Backend is ready.
```

### 3. Try in Browser

- Open http://localhost:5173
- Click "Start Camera" (or upload image)
- Should see real detection results instead of random ones

## Expected Performance

| Task                 | Time      | Notes                          |
| -------------------- | --------- | ------------------------------ |
| Backend startup      | 30-60s    | Models load from disk/download |
| First image upload   | 2-5s      | Depends on image size          |
| Live frame detection | 100-500ms | Runs every 3 seconds           |
| Camera permission    | Instant   | Browser native                 |

## Troubleshooting

**"Cannot connect to http://localhost:5000"**

- Ensure backend is running
- Check `python app.py` shows no errors
- Firewall might be blocking port 5000

**"No module named 'ultralytics'"**

- Backend venv not activated
- Run: `pip install -r requirements.txt`

**"CUDA out of memory"**

- Models too large for GPU
- Switch to CPU (automatic)
- Reduce resolution in CameraFeed.tsx

**Models loading forever**

- First load downloads ~2GB
- Check internet connection
- Try: `python -c "from ultralytics import YOLO; YOLO('yolov8s-pose.pt')"`

## What's Different from Notebook

| Aspect     | Notebook     | Web App                   |
| ---------- | ------------ | ------------------------- |
| Models     | Local Python | Flask API Server          |
| Input      | File upload  | Live camera + upload      |
| Output     | Console JSON | Beautiful UI              |
| Storage    | None         | localStorage (persistent) |
| Deployment | Colab        | Full stack                |

## Next Steps

1. ✅ Run `start.bat` or `./start.sh`
2. ✅ Wait for both servers to start
3. ✅ Open http://localhost:5173
4. ✅ Allow camera permissions
5. ✅ Click "Start Detection"
6. ✅ See real ML results!

## Production Deployment

### Frontend

```bash
npm run build
# Deploy dist/ to Vercel/Netlify
```

### Backend

```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:5000 app:app
# Deploy to Railway/Render/AWS
```

## Support

- **Backend issues?** → See `backend/README.md`
- **Frontend issues?** → Check browser console (F12)
- **API issues?** → Test with `python backend/test_backend.py`

---

**Status:** ✅ ML models fully integrated  
**Last Updated:** May 27, 2026  
**Framework:** Flask + React + YOLOv8 + Roboflow + EasyOCR
