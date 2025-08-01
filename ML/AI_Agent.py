from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import io
import easyocr
import re
import cv2
import os
from werkzeug.utils import secure_filename
import google.generativeai as genai
import json

app = Flask(__name__)
# CORS configuration for both endpoints - allow your frontend domain
CORS(app, resources={
    r"/extract-id-number": {"origins": ["http://localhost:3000", "https://your-frontend-domain.onrender.com"]}, 
    r"/upload": {"origins": ["http://localhost:3000", "https://your-frontend-domain.onrender.com"]}
})

# Configuration for file uploads
app.config['UPLOAD_FOLDER'] = 'static/uploads'
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}

# Initialize EasyOCR Reader (one-time setup for efficiency)
reader = easyocr.Reader(['en'], gpu=False)

# Configure Gemini API
try:
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY environment variable not set")
    genai.configure(api_key=GOOGLE_API_KEY)
    # Use gemini-1.5-flash for cost efficiency; switch to gemini-1.5-pro for better performance
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
except Exception as e:
    print(f"Failed to initialize Gemini API: {e}")
    gemini_model = None

# --- Placeholder phrases to ignore ---
PLACEHOLDER_PHRASES = {
    'your name here', 'your name', 'company name', 'your company name', 'job position',
    'your position here', 'email address goes here', 'website goes here',
    'address goes here, your city', 'address goes here', 'your logo', 'company tagline',
    '123 anywhere st., any city'
}

# --- Public email domains to avoid misinterpreting as company names ---
PUBLIC_EMAIL_DOMAINS = {
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'protonmail.com'
}

def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def preprocess_and_rotate(image):
    """Preprocesses the image for better OCR/Gemini results, including rotation."""
    img = np.array(image.convert("RGB"))
    
    # Rotate image if it's taller than it is wide
    h, w, _ = img.shape
    if h > w:
        img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
        
    # Convert to grayscale and apply sharpening
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sharpen_kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharp = cv2.filter2D(gray, -1, sharpen_kernel)
    
    # Apply thresholding
    _, thresh = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Save preprocessed image to a temporary file for Gemini
    _, buffer = cv2.imencode('.png', img)
    temp_image = Image.open(io.BytesIO(buffer))
    
    return thresh, img, temp_image

def extract_text_and_numbers(image_np):
    """Extracts text and numbers from an image using EasyOCR."""
    results = reader.readtext(image_np, detail=0, paragraph=False)
    full_text = ' '.join(results)
    
    # Extract Aadhar (12 digits, with optional spaces) and PAN (10 alphanumeric characters)
    aadhar_pattern = r'\b(?:\d{4}\s?\d{4}\s?\d{4}|\d{12})\b'
    pan_pattern = r'\b[A-Z]{5}\d{4}[A-Z]\b'
    numbers = re.findall(f'{aadhar_pattern}|{pan_pattern}', full_text)
    return numbers, results

def extract_email(text):
    """Extracts email addresses using regex."""
    match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    return match.group(0) if match else None

def extract_mobile_number(text):
    """Extracts a 10-digit mobile number, optionally with a +91 prefix."""
    mobile_patterns = [
        r'(?:m|mob|mobile)?[:\s]*(\+91[-\s]?)?([6-9]\d{9})\b',
        r'\b([6-9]\d{9})\b'
    ]
    
    for pattern in mobile_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            number = "".join(filter(None, match)).strip()
            if not re.search(r'(?:ext|extension|x|fax)\s*[:\s]*' + re.escape(number), text, re.IGNORECASE):
                return number
    
    return None

def extract_company_number(text):
    """Extracts a company landline number, potentially with context or an extension."""
    patterns = [
        r'(?:tel|phone|ph|o|office|work|fax)[:\s]*([\+]\d{1,3}[-\s]?)?(\(?\d{2,5}\)?[-\s]?\d{6,8}(\s*(?:ext|extension|x)[-:\s]*\d+)?)',
        r'(\+91[-\s]*(?:0?[1-5]\d|40|80|11|22|33|44)[-\s]*\d{6,8})(\s*(?:ext|extension|x)[-:\s]*\d+)?'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            full_number = "".join([g for g in match.groups() if g is not None]).strip()
            clean_number = re.sub(r'[^\d]', '', full_number)
            if len(clean_number) == 10 and clean_number.startswith(('6','7','8','9')):
                continue
            return full_number
    
    return None

def extract_website(text):
    """Extracts a website URL, improved to not misidentify email addresses."""
    match = re.search(r'\b(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9:%._\+~#=]{2,256}\.[a-zA-Z]{2,6}\b', text, re.IGNORECASE)
    if match:
        url = match.group(0)
        if '@' in url:
            return None
        if any(tld in url for tld in ['.com', '.in', '.org', '.net', '.co', '.io', '.tech']):
            return url
    return None

def extract_company_name(lines):
    """Extracts company name using a broader list of keywords."""
    company_keywords = [
        'pvt', 'ltd', 'limited', 'llp', 'inc', 'corp', 'solutions', 'services', 
        'industries', 'group', 'associates', 'consulting', 'global', 'technologies', 'software'
    ]
    for line in lines:
        if any(keyword in line.lower() for keyword in company_keywords):
            return line.strip().title()
    for line in lines:
        if line.isupper() and 2 < len(line.split()) < 5:
            return line.title()
    return "Not Found"

def extract_address(lines):
    """Extracts address by identifying generic address-related keywords."""
    address_parts = []
    address_keywords = [
        'block', 'house', 'road', 'street', 'avenue', 'lane', 'floor', 'building', 
        'marg', 'sector', 'pincode', 'india', r'\b\d{5,6}\b', 'nagar', 'park', 'ave'
    ]
    non_address_keywords = ['@', 'www', '.com', 'phone', 'mobile', 'email', 'pvt', 'ltd', r'\+91', 'director', 'manager']
    
    cleaned_lines = []
    for line in lines:
        cleaned_line = line.strip()
        cleaned_line = re.sub(r'[Ii][Ii][lI](?=\s|,|$)', 'III', cleaned_line, flags=re.IGNORECASE)
        cleaned_line = cleaned_line.replace(';', ',')
        if cleaned_line:
            cleaned_lines.append(cleaned_line)
    
    start_index = -1
    for i, line in enumerate(cleaned_lines):
        if any(re.search(keyword, line.lower()) for keyword in address_keywords):
            if not any(re.search(keyword, line.lower()) for keyword in non_address_keywords):
                start_index = i
                break
    
    if start_index != -1:
        for i in range(start_index, len(cleaned_lines)):
            line = cleaned_lines[i].strip()
            line_lower = line.lower()
            if not line: continue
            if any(re.search(keyword, line_lower) for keyword in non_address_keywords): break
            words = line.split()
            if len(words) in [2, 3] and all(word.isalpha() for word in words):
                if not any(re.search(keyword, line_lower) for keyword in address_keywords):
                    continue
            address_parts.append(line)
            if len(address_parts) >= 2 and any(re.search(keyword, line_lower) for keyword in ['india', r'\b\d{5,6}\b']):
                break
    
    pincode = None
    for line in cleaned_lines:
        pincode_match = re.search(r'\b(\d{6})\b', line)
        if pincode_match:
            pincode = pincode_match.group(1)
            break
    
    if pincode and not any(pincode in part for part in address_parts):
        address_parts.append(pincode)
        
    if address_parts:
        address = ', '.join(part for part in address_parts if part).strip()
        address = re.sub(r'\s*,\s*', ', ', address).replace(" ,", ",")
        
        address_parts_formatted = address.split(', ')
        final_parts = []
        for part in address_parts_formatted:
            formatted_part = part.title()
            formatted_part = re.sub(r'\bIii\b', 'III', formatted_part)
            words = formatted_part.split(' ')
            corrected_words = [word.upper() if len(word) == 2 and word.isalpha() else word for word in words]
            final_parts.append(' '.join(corrected_words))
        
        address = ', '.join(final_parts)
        address = re.sub(r'([A-Za-z]+)\s*-\s*(III)', r'\1-\2', address)
        address = re.sub(r',\s*(\d{5,6})$', r' - \1', address)
        return address

    return "Not Found"

def extract_name_and_designation(lines):
    """Extracts name and designation using a more robust filtering approach."""
    name = None
    designation = None
    
    designation_keywords = [
        'director', 'manager', 'engineer', 'strategy', 'delivery', 'officer', 'ceo', 'cto', 
        'cfo', 'coo', 'founder', 'partner', 'consultant', 'president', 'executive', 
        'analyst', 'developer', 'designer', 'architect', 'head', 'lead', 'specialist', 'project manager'
    ]
    
    non_name_keywords = [
        '@', '.com', 'www', 'http', '+', 'tel', 'mob', 'email', 'website',
        'pvt', 'ltd', 'inc', 'corp', 'solutions', 'services', 'technologies', 'industries', 'llp', 'group',
        'road', 'street', 'floor', 'lane', 'marg', 'sector', 'pincode', 'nagar', 'house', 
        'block', 'building', 'avenue', 'india'
    ]
    
    candidates = []
    for line in lines:
        line_lower = line.lower()
        if not any(char.isdigit() for char in line) and not any(kw in line_lower for kw in non_name_keywords):
            if 0 < len(line.split()) < 5:
                candidates.append(line.strip())

    remaining_candidates = []
    for line in candidates:
        if any(re.search(r'\b' + keyword + r'\b', line.lower()) for keyword in designation_keywords):
            if not designation:
                designation = line.title()
        else:
            remaining_candidates.append(line)

    if remaining_candidates:
        name_candidates = [c for c in remaining_candidates if len(c.split()) in [2, 3]]
        if name_candidates:
            name = max(name_candidates, key=len).title()
        elif remaining_candidates:
            name = max(remaining_candidates, key=len).title()

    return name, designation

def extract_custom_data(lines, prompt):
    """Extracts data based on the user prompt using EasyOCR results."""
    if not prompt:
        return None

    prompt = prompt.lower().strip()
    full_text = ' '.join(lines)
    result = {}

    # Define common fields and their extraction logic
    field_extractors = {
        'name': lambda: extract_name_and_designation(lines)[0],
        'designation': lambda: extract_name_and_designation(lines)[1],
        'company': lambda: extract_company_name(lines),
        'email': lambda: extract_email(full_text),
        'mobile': lambda: extract_mobile_number(full_text),
        'phone': lambda: extract_mobile_number(full_text),  # Alias for mobile
        'company number': lambda: extract_company_number(full_text),
        'company tel': lambda: extract_company_number(full_text),  # Alias
        'website': lambda: extract_website(full_text),
        'address': lambda: extract_address(lines),
        'items': lambda: ', '.join([line for line in lines if any(kw in line.lower() for kw in ['item', 'items', 'product', 'products'])])
    }

    # Parse prompt to identify requested fields
    requested_fields = []
    for field in field_extractors.keys():
        if field in prompt:
            requested_fields.append(field)

    # If no specific fields are mentioned, try to infer from context
    if not requested_fields:
        if 'receipt' in prompt:
            requested_fields = ['items', 'company', 'address']
        elif 'business card' in prompt:
            requested_fields = ['name', 'designation', 'company', 'email', 'mobile', 'company tel', 'website', 'address']
        else:
            requested_fields = list(field_extractors.keys())  # Default to all fields

    # Extract requested fields
    for field in requested_fields:
        result[field] = field_extractors[field]() or "Not Found"

    return result or {"message": "No relevant data extracted based on prompt"}

def gemini_extract_data(image, prompt, extraction_type='business_card'):
    """Extracts data using Gemini API based on the prompt or extraction type."""
    if not gemini_model:
        raise ValueError("Gemini API not initialized")

    try:
        # Default prompt for business card or ID card if none provided
        if not prompt:
            if extraction_type == 'business_card':
                prompt = """
                Extract structured data from this business card image. Return a JSON object with the following fields if present: 
                name, designation, company, email, personal_mobile_number, company_number, website, address. 
                If a field is not found, set its value to "Not Found". Ensure the output is valid JSON.
                """
            else:  # id_card
                prompt = """
                Extract Aadhar or PAN numbers from this ID card image. Return a JSON object with fields: 
                Aadhar (list of 12-digit numbers), PAN (list of 10-character alphanumeric codes), General Numbers (all detected numbers). 
                If no numbers are found, return empty lists. Ensure the output is valid JSON.
                """

        # Prepare the Gemini request
        response = gemini_model.generate_content([
            {"text": prompt},
            {"image": image}
        ])

        # Extract JSON from the response
        json_str = response.text.strip()
        # Clean up potential markdown or extra text
        if json_str.startswith('```json'):
            json_str = json_str[7:].rstrip('```').strip()
        
        try:
            result = json.loads(json_str)
            return result
        except json.JSONDecodeError:
            raise ValueError("Gemini returned invalid JSON")

    except Exception as e:
        raise Exception(f"Gemini API error: {str(e)}")

@app.route('/extract-id-number', methods=['POST'])
def extract_id_number():
    """Extract Aadhar, PAN, and general numbers from an uploaded image using Gemini or EasyOCR."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        image = Image.open(file.stream)
        processed_img, _, gemini_img = preprocess_and_rotate(image)

        # Try Gemini first if available
        if gemini_model:
            try:
                gemini_result = gemini_extract_data(gemini_img, "", extraction_type='id_card')
                # Validate Gemini response
                if isinstance(gemini_result, dict) and all(key in gemini_result for key in ['Aadhar', 'PAN', 'General Numbers']):
                    return jsonify(gemini_result), 200
            except Exception as e:
                print(f"Gemini failed for ID extraction: {e}")

        # Fallback to EasyOCR
        number_results, _ = extract_text_and_numbers(processed_img)
        cleaned_numbers = [re.sub(r'\s+', '', num) for num in number_results]

        response = {
            'Aadhar': [num for num in cleaned_numbers if re.match(r'^\d{12}$', num)],
            'PAN': [num for num in cleaned_numbers if re.match(r'^[A-Z]{5}\d{4}[A-Z]$', num)],
            'General Numbers': cleaned_numbers
        }
        return jsonify(response), 200

    except Exception as e:
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500

@app.route('/upload', methods=['POST'])
def upload_image():
    """Extract details from an image based on user prompt using Gemini or EasyOCR."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Allowed types: jpg, jpeg, png"}), 400

    try:
        image = Image.open(file.stream)
        processed_img, _, gemini_img = preprocess_and_rotate(image)
        prompt = request.form.get('prompt', '').strip()

        # Try Gemini first if available
        if gemini_model:
            try:
                gemini_result = gemini_extract_data(gemini_img, prompt, extraction_type='business_card')
                # Validate Gemini response
                if isinstance(gemini_result, dict):
                    return jsonify(gemini_result), 200
            except Exception as e:
                print(f"Gemini failed for business card extraction: {e}")

        # Fallback to EasyOCR
        results = reader.readtext(processed_img, detail=0, paragraph=False)
        filtered_results = [line for line in results if line.lower().strip() not in PLACEHOLDER_PHRASES]

        if prompt:
            # Use prompt-based extraction with EasyOCR
            response_data = extract_custom_data(filtered_results, prompt)
        else:
            # Default behavior: extract business card details with EasyOCR
            full_text = ' '.join(filtered_results)
            email = extract_email(full_text)
            mobile_number = extract_mobile_number(full_text)
            company_number = extract_company_number(full_text)
            website = extract_website(full_text)
            name, designation = extract_name_and_designation(filtered_results)
            company = extract_company_name(filtered_results)

            if company == "Not Found" and email:
                domain = email.split('@')[1]
                if domain.lower() not in PUBLIC_EMAIL_DOMAINS:
                    tlds = ['.com', '.in', '.org', '.net', '.co.uk', '.co.in', '.co']
                    for tld in sorted(tlds, key=len, reverse=True):
                        if domain.endswith(tld):
                            domain = domain[:-len(tld)]
                            break
                    company = domain.replace('-', ' ').title()

            address = extract_address(filtered_results)
            
            response_data = {
                "name": name if name else "Not Found",
                "designation": designation if designation else "Not Found",
                "company": company if company else "Not Found",
                "email": email if email else "Not Found",
                "personal_mobile_number": mobile_number if mobile_number else "Not Found",
                "company_number": company_number if company_number else "Not Found",
                "website": website if website else "Not Found",
                "address": address if address else "Not Found",
            }

        return jsonify(response_data), 200
            
    except Exception as e:
        return jsonify({"error": f"An error occurred during processing: {e}"}), 500

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)