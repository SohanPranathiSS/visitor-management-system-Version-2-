from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import io
import re
import cv2
import os
from werkzeug.utils import secure_filename
import gc

app = Flask(__name__)

# CORS configuration for production - optimized for memory
CORS(app, resources={
    r"/extract-id-number": {
        "origins": [
            "http://localhost:3000", 
            "https://localhost:3000",
            "https://visitor-management-system-version-2.vercel.app",
            "https://visitor-management-system-version-2.netlify.app",
            "https://visitor-management-system-version-2.onrender.com",
            "https://*.vercel.app",
            "https://*.netlify.app", 
            "https://*.onrender.com"
        ]
    }, 
    r"/upload": {
        "origins": [
            "http://localhost:3000",
            "https://localhost:3000", 
            "https://visitor-management-system-version-2.vercel.app",
            "https://visitor-management-system-version-2.netlify.app",
            "https://visitor-management-system-version-2.onrender.com",
            "https://*.vercel.app",
            "https://*.netlify.app",
            "https://*.onrender.com"
        ]
    }
})

# Configuration for file uploads
app.config['UPLOAD_FOLDER'] = 'static/uploads'
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}

# Global OCR reader - lazy initialization to save memory
ocr_reader = None

def get_ocr_reader():
    """Lazy initialization of OCR reader to save memory"""
    global ocr_reader
    if ocr_reader is None:
        try:
            import easyocr
            ocr_reader = easyocr.Reader(['en'], gpu=False)
        except ImportError:
            # Fallback to basic text extraction without OCR
            ocr_reader = "basic"
    return ocr_reader

def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def lightweight_preprocess(image):
    """Lightweight preprocessing to reduce memory usage"""
    try:
        # Convert to numpy array with memory optimization
        img = np.array(image.convert("RGB"))
        
        # Resize if image is too large (memory optimization)
        h, w, _ = img.shape
        max_dimension = 1200
        if max(h, w) > max_dimension:
            scale = max_dimension / max(h, w)
            new_h, new_w = int(h * scale), int(w * scale)
            img = cv2.resize(img, (new_w, new_h))
        
        # Rotate if needed
        h, w, _ = img.shape
        if h > w:
            img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
            
        # Simple grayscale conversion
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Force garbage collection
        gc.collect()
        
        return gray
    except Exception as e:
        print(f"Preprocessing error: {e}")
        return None

def extract_text_lightweight(image_np):
    """Lightweight text extraction with memory optimization"""
    try:
        reader = get_ocr_reader()
        if reader == "basic":
            # Basic pattern matching without OCR
            return [], []
        
        # Use EasyOCR with memory optimization
        results = reader.readtext(image_np, detail=0, paragraph=False)
        
        # Clean up memory immediately
        gc.collect()
        
        full_text = ' '.join(results) if results else ""
        
        # Extract patterns
        aadhar_pattern = r'\b(?:\d{4}\s?\d{4}\s?\d{4}|\d{12})\b'
        pan_pattern = r'\b[A-Z]{5}\d{4}[A-Z]\b'
        numbers = re.findall(f'{aadhar_pattern}|{pan_pattern}', full_text)
        
        return numbers, results
    except Exception as e:
        print(f"Text extraction error: {e}")
        return [], []

def detect_card_type_lightweight(text_results, numbers):
    """Lightweight card type detection using keyword analysis"""
    if not text_results:
        return 'Other'
    
    try:
        full_text = ' '.join(text_results).lower()
        
        # Keyword-based detection with memory optimization
        card_keywords = {
            'Aadhar': ['aadhaar', 'aadhar', 'unique identification', 'uidai', 'government of india'],
            'PAN': ['income tax', 'pan', 'permanent account number', 'govt of india'],
            'Driving Licence': ['driving license', 'driving licence', 'dl no', 'license to drive', 'transport'],
            'Passport': ['passport', 'republic of india', 'type/type', 'place of birth'],
            'Voter ID': ['election commission', 'voter', 'electors photo identity card', 'epic no']
        }
        
        for card_type, keywords in card_keywords.items():
            if any(keyword in full_text for keyword in keywords):
                return card_type
        
        # Pattern-based detection
        if numbers:
            for num in numbers:
                clean_num = re.sub(r'\s+', '', num)
                if re.match(r'^\d{12}$', clean_num):
                    return 'Aadhar'
                elif re.match(r'^[A-Z]{5}\d{4}[A-Z]$', clean_num):
                    return 'PAN'
        
        return 'Other'
    except Exception as e:
        print(f"Card detection error: {e}")
        return 'Other'

@app.route('/extract-id-number', methods=['POST'])
def extract_id_number():
    """Memory-optimized ID number extraction"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Process image with memory optimization
        image = Image.open(file.stream)
        
        # Lightweight preprocessing
        processed_img = lightweight_preprocess(image)
        if processed_img is None:
            return jsonify({'error': 'Image processing failed'}), 500
        
        # Extract text and numbers
        number_results, text_results = extract_text_lightweight(processed_img)
        
        # Clean up image memory
        del image, processed_img
        gc.collect()
        
        # Process results
        cleaned_numbers = [re.sub(r'\s+', '', num) for num in number_results]
        detected_card_type = detect_card_type_lightweight(text_results, cleaned_numbers)
        
        # Categorize numbers
        aadhar_numbers = [num for num in cleaned_numbers if re.match(r'^\d{12}$', num)]
        pan_numbers = [num for num in cleaned_numbers if re.match(r'^[A-Z]{5}\d{4}[A-Z]$', num)]
        
        # Determine primary number
        primary_number = None
        primary_type = detected_card_type
        
        if detected_card_type == 'Aadhar' and aadhar_numbers:
            primary_number = aadhar_numbers[0]
        elif detected_card_type == 'PAN' and pan_numbers:
            primary_number = pan_numbers[0]
        elif aadhar_numbers:
            primary_number = aadhar_numbers[0]
            primary_type = 'Aadhar'
        elif pan_numbers:
            primary_number = pan_numbers[0]
            primary_type = 'PAN'
        elif cleaned_numbers:
            primary_number = cleaned_numbers[0]
        
        response = {
            'detected_card_type': detected_card_type,
            'primary_number': primary_number,
            'primary_type': primary_type,
            'Aadhar': aadhar_numbers,
            'PAN': pan_numbers,
            'General Numbers': cleaned_numbers,
            'extracted_text': text_results[:5] if text_results else [],  # Limit to save memory
            'confidence': 'high' if primary_number and (detected_card_type in ['Aadhar', 'PAN']) else 'medium'
        }
        
        # Final cleanup
        gc.collect()
        
        return jsonify(response)
        
    except Exception as e:
        # Clean up memory on error
        gc.collect()
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'ID Card OCR', 'version': 'lightweight'})

@app.route('/', methods=['GET'])
def home():
    """Root endpoint"""
    return jsonify({
        'message': 'Visitor Management ML Service - Lightweight Version',
        'endpoints': ['/extract-id-number', '/health'],
        'status': 'running'
    })

if __name__ == '__main__':
    # Memory-optimized configuration
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
