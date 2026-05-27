# School Uniform Compliance Detection System

Full-stack web application combining computer vision ML models with a React frontend for real-time uniform compliance detection.

## Project Structure

```
Camera Live Feed UI/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # Main app with detection history
│   │   └── components/
│   │       ├── CameraFeed.tsx       # Live camera + real-time detection
│   │       ├── ImageUpload.tsx      # Image upload with detection
│   │       ├── DetectionResults.tsx # Analytics dashboard
│   │       └── DetectionStatusPanel.tsx # Current status display
│   └── main.tsx
├── backend/                         # ML models backend
│   ├── app.py                      # Flask server with detection API
│   ├── requirements.txt
│   └── README.md
├── package.json
├── vite.config.ts
└── .env.local                      # API URL configuration
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- 16GB+ RAM (for GPU ML models)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run server
python app.py
```

Backend API will be available at `http://localhost:5000`

## Features

### Real-Time Live Camera Detection

- Captures frames every 3 seconds when detection is active
- Calls backend API for uniform classification
- Draws bounding boxes with detection results
- Shows live confidence scores

### Image Upload Detection

- Upload single images for analysis
- Returns detailed classification results
- Stores results in detection history

### Detection History

- All detections persist in localStorage
- Survives page reloads
- Individual removal buttons for each detection
- Clear all history option with confirmation

### Analytics Dashboard

- Statistics: total scans, compliant, violations, confidence
- Distribution charts (pie, bar, timeline)
- Complete detection log with filtering

### Multi-Layer Classification System

**Layer 1: Shape Detection** (Roboflow DETR)

- Detects garment type
- Direct pass for white shirts

**Layer 2: Text Recognition** (EasyOCR)

- Scans for organization text
- Validates against BatStateU whitelist

**Layer 3: Logo Detection** (YOLO)

- Detects official logos
- Confirms organizational uniform

**Layer 4: Color Analysis**

- Neutralizes stage lighting
- Detects white garments as fallback

## API Reference

### Health Check

```bash
curl http://localhost:5000/api/health
```

### Image Detection

```bash
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'
```

Response format:

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

## Configuration

### Environment Variables

Create `.env.local` in project root:

```bash
VITE_API_URL=http://localhost:5000
```

### Backend Settings

Edit `backend/app.py`:

- `DEVICE`: Auto-detects CUDA (GPU) or CPU
- `pose_model`: YOLOv8 pose detection model
- `shape_model`: Roboflow garment classifier
- `ocr_reader`: EasyOCR text detection
- `VALID_ORG_KEYWORDS`: Organization whitelist

## Performance

| Device     | Speed    | FPS   |
| ---------- | -------- | ----- |
| GPU (CUDA) | 50-200ms | 5-20  |
| CPU        | 500ms-2s | 0.5-1 |

Live detection runs every 3 seconds to balance accuracy and performance.

## Troubleshooting

### Camera not showing

1. Check browser permissions for camera access
2. Ensure HTTPS or localhost (required for getUserMedia)
3. Check console for errors

### Backend connection failed

```bash
# Check backend is running
curl http://localhost:5000/api/health

# View backend logs for errors
python app.py  # Shows detailed output
```

### Models taking too long to load

- First load downloads models (~2-5GB)
- Subsequent loads are instant (cached locally)
- Use GPU for 10-20x speedup

### Memory issues

- Reduce image resolution in CameraFeed.tsx
- Lower detection frequency (increase interval from 3000ms)
- Use CPU-only mode if GPU memory limited

## Deployment

### Frontend (Vercel/Netlify)

```bash
npm run build
# Deploy dist/ folder
```

### Backend (Railway/Render/AWS)

```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

## Technology Stack

**Frontend:**

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts (analytics)
- Lucide Icons
- localStorage (persistence)

**Backend:**

- Flask
- YOLOv8 (Ultralytics)
- Roboflow
- EasyOCR
- PyTorch
- OpenCV

## License

MIT License - See LICENSE file

## Support

For issues or questions:

1. Check `backend/README.md` for ML model setup
2. Review browser console for client-side errors
3. Check Flask terminal for server-side errors
4. Verify API health: `curl http://localhost:5000/api/health`
