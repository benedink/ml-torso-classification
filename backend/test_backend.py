#!/usr/bin/env python
"""
Quick test script to verify backend API is working
"""

import requests
import json
import sys
from pathlib import Path

# Configuration
API_URL = "http://localhost:5000"
HEALTH_ENDPOINT = f"{API_URL}/api/health"
DETECT_ENDPOINT = f"{API_URL}/api/detect"

def test_health():
    """Test that backend is reachable"""
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✓ Backend is running")
            print(f"  Device: {data.get('device')}")
            print(f"  Models: {json.dumps(data.get('models'), indent=2)}")
            return True
        else:
            print(f"✗ Backend returned {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to {API_URL}")
        print("  Make sure backend is running: python app.py")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_detect(image_path=None):
    """Test detection endpoint with a sample image"""
    if not image_path:
        print("No image provided, skipping detection test")
        return True

    image_path = Path(image_path)
    if not image_path.exists():
        print(f"✗ Image not found: {image_path}")
        return False

    try:
        # Read and encode image
        with open(image_path, 'rb') as f:
            import base64
            image_data = base64.b64encode(f.read()).decode('utf-8')

        # Send to API
        response = requests.post(
            DETECT_ENDPOINT,
            json={"image": f"data:image/jpeg;base64,{image_data}"},
            timeout=30
        )

        if response.status_code == 200:
            results = response.json()
            print("✓ Detection successful")
            print(f"  Allowed: {len(results.get('allowed', []))}")
            print(f"  Not Allowed: {len(results.get('not_allowed', []))}")
            if results.get('allowed'):
                print(f"  Sample: {results['allowed'][0]}")
            return True
        else:
            print(f"✗ Detection failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False

    except Exception as e:
        print(f"✗ Detection error: {e}")
        return False

if __name__ == "__main__":
    print("Testing School Uniform Detection Backend")
    print("=" * 50)

    # Test 1: Health
    health_ok = test_health()
    print()

    # Test 2: Detection (optional, if image provided)
    if len(sys.argv) > 1:
        detect_ok = test_detect(sys.argv[1])
    else:
        print("Usage: python test_backend.py [image_path]")
        print("Example: python test_backend.py test.jpg")
        detect_ok = True

    print()
    if health_ok and detect_ok:
        print("✓ All tests passed! Backend is ready.")
        sys.exit(0)
    else:
        print("✗ Some tests failed. Check backend setup.")
        sys.exit(1)
