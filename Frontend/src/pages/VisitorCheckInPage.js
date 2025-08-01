import React, { useState, useRef, useEffect } from 'react';
import { checkInVisitor, getHosts } from '../utils/apiService';
import '../styles/VisitorCheckInPage.css';
import { useNavigate, useLocation } from 'react-router-dom';

// This is your OCR API for extracting an ID number from a photo, if needed on this page.
const OCR_API_URL = 'http://127.0.0.1:5000/extract-id-number';

const VisitorCheckInPage = () => {
    // --- Get prefillData and hostName from the route's state ---
    const { state } = useLocation();
    const prefillData = state?.prefillData || {};
    const preRegData = state?.preRegData || {}; // QR scan data
    const initialHostName = state?.hostName || preRegData.hostName || '';
    const fromQRScan = state?.fromQRScan || false;
    
    // --- Initialize form state with pre-filled data, including new optional fields ---
    const [formData, setFormData] = useState({
        name: prefillData.name || preRegData.name || '',
        email: prefillData.email || preRegData.email || '',
        phone: prefillData.phone || preRegData.phone || '',
        designation: prefillData.designation || '',
        company: prefillData.company || preRegData.company || '',
        companyTel: prefillData.companyTel || '',
        website: prefillData.website || '',
        address: prefillData.address || '',
        hostName: initialHostName,
        reason: preRegData.reason || '', // Pre-fill reason from QR scan
        itemsCarried: '',
        photo: null,
        idCardPhoto: null,
        idCardNumber: '',
        idCardType: '', // New field for ID card type
        // QR scan specific fields - match backend field names
        qr_code: preRegData.qr_code || null,
        pre_registration_id: preRegData.id || null
    });

    // Debug: Log QR scan data to understand what's being passed
    useEffect(() => {
        if (fromQRScan) {
            console.log('🔍 QR Scan detected!');
            console.log('📦 preRegData:', preRegData);
            console.log('🎯 Reason from QR:', preRegData.reason);
            console.log('📝 Initial form state:', formData);
            console.log('✅ fromQRScan flag:', fromQRScan);
            console.log('🔗 All state data:', { fromQRScan, preRegData, formData });
        }
    }, [fromQRScan, preRegData]);

    // Additional debug for reason field specifically
    useEffect(() => {
        console.log('🎯 Reason field value changed:', formData.reason);
        console.log('🎯 Is from QR scan?', fromQRScan);
        console.log('🎯 Should show indicator?', fromQRScan && formData.reason);
    }, [formData.reason, fromQRScan]);

    // Handle potential reason field mismatches from QR scan
    useEffect(() => {
        if (fromQRScan && preRegData.reason) {
            const qrReason = preRegData.reason;
            const validOptions = [
                "Interview", "Client Meeting", "Contractor", "Guest", 
                "Vendor/Supplier Visit", "Business Partnership/Collaboration", 
                "Training/Workshop", "Official Audit/Inspection", 
                "Facility Tour/Investor Visit", "Technical Service or Maintenance"
            ];
            
            console.log('🔍 Checking reason match:', qrReason);
            console.log('📋 Valid options:', validOptions);
            
            // Check if QR reason exactly matches any option
            if (validOptions.includes(qrReason)) {
                console.log('✅ Exact match found for reason:', qrReason);
                setFormData(prev => ({ ...prev, reason: qrReason }));
            } else {
                // Try to find a close match
                const lowerQrReason = qrReason.toLowerCase();
                let matchedReason = null;
                
                for (const option of validOptions) {
                    if (option.toLowerCase().includes(lowerQrReason) || 
                        lowerQrReason.includes(option.toLowerCase())) {
                        matchedReason = option;
                        break;
                    }
                }
                
                if (matchedReason) {
                    console.log('🔄 Close match found:', qrReason, '→', matchedReason);
                    setFormData(prev => ({ ...prev, reason: matchedReason }));
                } else {
                    console.log('❌ No match found for reason:', qrReason, 'keeping original value');
                }
            }
        }
    }, [fromQRScan, preRegData.reason]);

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isIdCardCameraOn, setIsIdCardCameraOn] = useState(false);
    const [hosts, setHosts] = useState([]);
    const [userRole, setUserRole] = useState(null);
    const videoRef = useRef(null);
    const idCardVideoRef = useRef(null);
    const canvasRef = useRef(null);
    const idCardCanvasRef = useRef(null);
    const navigate = useNavigate();

    // Fetch user role and available hosts
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const loggedInUser = JSON.parse(localStorage.getItem('user'));
                if (loggedInUser && loggedInUser.role) {
                    setUserRole(loggedInUser.role);
                    
                    // Fetch available hosts for the user's company
                    const hostsData = await getHosts();
                    setHosts(hostsData);
                    
                    // If user is a host and no initial host name is provided, set it to their own name
                    if (loggedInUser.role === 'host' && !initialHostName && hostsData.length > 0) {
                        setFormData(prev => ({ ...prev, hostName: hostsData[0].name }));
                    }
                }
            } catch (err) {
                console.error('Error fetching user data or hosts:', err);
                setError('Failed to load host information.');
            }
        };
        
        fetchUserData();
    }, [initialHostName]);

    // The rest of your functions (extractIdNumber, camera controls, etc.) remain the same.
    const extractIdNumberFromImage = async (imageDataUrl) => {
        if (!imageDataUrl) {
            setError('No ID card photo available to extract.');
            return;
        }
        try {
            const base64 = imageDataUrl.split(',')[1];
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('file', blob, 'idcard.jpg');

            const response = await fetch(OCR_API_URL, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('OCR API error');
            const data = await response.json();
            
            let number = '';
            let detectedType = '';
            
            // Use the new enhanced response format
            if (data.primary_number && data.primary_type) {
                number = data.primary_number;
                detectedType = data.primary_type;
            } else {
                // Fallback to old format for compatibility
                if (data.Aadhar && data.Aadhar.length > 0) {
                    number = data.Aadhar[0];
                    detectedType = 'Aadhar';
                } else if (data.PAN && data.PAN.length > 0) {
                    number = data.PAN[0];
                    detectedType = 'PAN';
                } else if (data['General Numbers'] && data['General Numbers'].length > 0) {
                    number = data['General Numbers'][0];
                    // Try to detect type based on number pattern
                    if (number.length === 12 && /^\d{12}$/.test(number)) {
                        detectedType = 'Aadhar';
                    } else if (number.length === 10 && /^[A-Z]{5}\d{4}[A-Z]$/.test(number)) {
                        detectedType = 'PAN';
                    } else {
                        detectedType = 'Other';
                    }
                }
            }
            
            if (number) {
                setFormData(prev => ({ 
                    ...prev, 
                    idCardNumber: number,
                    idCardType: detectedType 
                }));
                
                const confidenceText = data.confidence === 'high' ? ' with high confidence' : '';
                setMessage(`${detectedType ? detectedType + ' ' : ''}ID Card Number extracted successfully${confidenceText}!`);
                
                // Show additional info if available
                if (data.detected_card_type && data.detected_card_type !== detectedType) {
                    console.log('🔍 Card type detection:', {
                        detected: data.detected_card_type,
                        used: detectedType,
                        confidence: data.confidence,
                        extractedText: data.extracted_text
                    });
                }
            } else {
                setError('No valid ID number found in the image.');
            }
        } catch (err) {
            setError('Failed to extract ID number: ' + err.message);
        }
    };

    useEffect(() => {
        if (isCameraOn) {
            startCamera();
        } else if (!isCameraOn && videoRef.current && videoRef.current.srcObject) {
            stopCamera();
        }

        if (isIdCardCameraOn) {
            startIdCardCamera();
        } else if (!isIdCardCameraOn && idCardVideoRef.current && idCardVideoRef.current.srcObject) {
            stopIdCardCamera();
        }
        return () => {
            stopCamera();
            stopIdCardCamera();
        };
    }, [isCameraOn, isIdCardCameraOn]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setError('Failed to access camera for photo: ' + err.message);
            setIsCameraOn(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const startIdCardCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (idCardVideoRef.current) {
                idCardVideoRef.current.srcObject = stream;
            }
        } catch (err) {
            setError('Failed to access camera for ID card: ' + err.message);
            setIsIdCardCameraOn(false);
        }
    };

    const stopIdCardCamera = () => {
        if (idCardVideoRef.current && idCardVideoRef.current.srcObject) {
            const tracks = idCardVideoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            idCardVideoRef.current.srcObject = null;
        }
    };

    const handleCapture = () => {
        if (canvasRef.current && videoRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageDataUrl = canvasRef.current.toDataURL('image/jpeg');
            setFormData(prev => ({ ...prev, photo: imageDataUrl }));
            stopCamera();
            setIsCameraOn(false);
        }
    };

    const handleIdCardCapture = () => {
        if (idCardCanvasRef.current && idCardVideoRef.current) {
            const context = idCardCanvasRef.current.getContext('2d');
            idCardCanvasRef.current.width = idCardVideoRef.current.videoWidth;
            idCardCanvasRef.current.height = idCardVideoRef.current.videoHeight;
            context.drawImage(idCardVideoRef.current, 0, 0, idCardCanvasRef.current.width, idCardCanvasRef.current.height);
            const imageDataUrl = idCardCanvasRef.current.toDataURL('image/jpeg');
            setFormData(prev => ({ ...prev, idCardPhoto: imageDataUrl }));
            stopIdCardCamera();
            setIsIdCardCameraOn(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (files && files[0]) {
            const reader = new FileReader();
            reader.onload = () => {
                setFormData(prev => ({ ...prev, [name]: reader.result }));
            };
            reader.readAsDataURL(files[0]);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Function to get placeholder text and validation pattern based on ID card type
    const getIdCardInfo = (type) => {
        switch (type) {
            case 'Aadhar':
                return {
                    placeholder: 'Enter 12-digit Aadhar number (e.g., 123456789012)',
                    pattern: /^\d{12}$/,
                    maxLength: 12
                };
            case 'PAN':
                return {
                    placeholder: 'Enter 10-character PAN (e.g., ABCDE1234F)',
                    pattern: /^[A-Z]{5}\d{4}[A-Z]$/,
                    maxLength: 10
                };
            case 'Driving Licence':
                return {
                    placeholder: 'Enter driving licence number',
                    pattern: null,
                    maxLength: 20
                };
            case 'Passport':
                return {
                    placeholder: 'Enter passport number',
                    pattern: null,
                    maxLength: 15
                };
            case 'Voter ID':
                return {
                    placeholder: 'Enter voter ID number',
                    pattern: null,
                    maxLength: 15
                };
            case 'Employee ID':
                return {
                    placeholder: 'Enter employee ID number',
                    pattern: null,
                    maxLength: 20
                };
            default:
                return {
                    placeholder: 'Enter ID card number',
                    pattern: null,
                    maxLength: 25
                };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        
        const { name, email, hostName, reason, idCardNumber, idCardType } = formData;
        if (!name || !email || !hostName || !reason || !idCardNumber || !idCardType) {
            setError('Please fill in all required fields.');
            return;
        }

        // Validate ID card number format based on type
        const idCardInfo = getIdCardInfo(idCardType);
        if (idCardInfo.pattern && !idCardInfo.pattern.test(idCardNumber)) {
            if (idCardType === 'Aadhar') {
                setError('Invalid Aadhar number. Please enter a 12-digit number.');
            } else if (idCardType === 'PAN') {
                setError('Invalid PAN number. Format should be: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F).');
            }
            return;
        }

        try {
            // Include QR scan info and pre-registration data for backend processing
            const checkInData = {
                ...formData,
                fromQRScan,
                pre_registration_id: preRegData.id || null,
                qr_code: preRegData.qr_code || null
            };
            
            // Debug: Log the data being sent to backend
            console.log('Sending check-in data:', checkInData);
            console.log('QR scan info:', { fromQRScan, preRegData });
            
            await checkInVisitor(checkInData);
            setMessage('Check-in successful!');
            setTimeout(() => {
                // Navigate to the host dashboard or a success page
                navigate('/host');
            }, 2000);
        } catch (error) {
            setError(error.message || 'Check-in failed.');
        }
    };

    return (
        <div className="visitor-checkin-container">
            <div className="visitor-checkin-content">
                <div className="visitor-checkin-header">
                    <h2 className="visitor-checkin-title">Visitor Check-In</h2>
                    {fromQRScan ? (
                        <div className="qr-scan-notification">
                            <p className="qr-scan-message">
                                ✅ <strong>QR Code Scanned Successfully!</strong> 
                                <br />
                                Pre-registration details have been auto-filled. Please review and confirm the information below.
                            </p>
                            
                            {/* Debug Panel - Remove this after testing */}
                            <details style={{marginTop: '1rem', background: 'rgba(255,255,255,0.3)', padding: '1rem', borderRadius: '8px'}}>
                                <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>🔍 Debug: QR Scan Data</summary>
                                <div style={{marginTop: '0.5rem', fontSize: '0.9rem', fontFamily: 'monospace'}}>
                                    <div><strong>Reason from QR:</strong> "{preRegData.reason}"</div>
                                    <div><strong>Form Reason Value:</strong> "{formData.reason}"</div>
                                    <div><strong>All preRegData:</strong> {JSON.stringify(preRegData, null, 2)}</div>
                                </div>
                            </details>
                        </div>
                    ) : (
                        <p className="visitor-checkin-subtitle">Please fill in your details for a smooth check-in process</p>
                    )}
                </div>
                
                <form className="visitor-checkin-form" onSubmit={handleSubmit}>
                    {/* Personal Information Section */}
                    <div className="form-section">
                        <h3 className="section-title">Personal Information</h3>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>
                                    Full Name <span className="required-indicator">*</span>
                                    {/* {fromQRScan && formData.name && (
                                        <span className="qr-filled-indicator"> (Auto-filled from QR)</span>
                                    )} */}
                                </label>
                                <input 
                                    name="name" 
                                    value={formData.name} 
                                    onChange={handleChange} 
                                    className={fromQRScan && formData.name ? "qr-auto-filled" : ""}
                                    required 
                                />
                            </div>
                            <div className="form-field">
                                <label>
                                    Email <span className="required-indicator">*</span>
                                    {/* {fromQRScan && formData.email && (
                                        <span className="qr-filled-indicator"> (Auto-filled from QR)</span>
                                    )} */}
                                </label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    className={fromQRScan && formData.email ? "qr-auto-filled" : ""}
                                    required 
                                />
                            </div>
                            <div className="form-field">
                                <label>
                                    Phone Number
                                    {/* {fromQRScan && formData.phone && (
                                        <span className="qr-filled-indicator"> (Auto-filled from QR)</span>
                                    )} */}
                                </label>
                                <input 
                                    name="phone" 
                                    value={formData.phone} 
                                    onChange={handleChange} 
                                    className={fromQRScan && formData.phone ? "qr-auto-filled" : ""}
                                />
                            </div>
                            <div className="form-field">
                                <label>ID Card Type <span className="required-indicator">*</span></label>
                                <select name="idCardType" value={formData.idCardType} onChange={handleChange} required>
                                    <option value="" disabled>-- Select ID Card Type --</option>
                                    <option value="Aadhar">Aadhar Card</option>
                                    <option value="PAN">PAN Card</option>
                                    <option value="Driving Licence">Driving Licence</option>
                                    <option value="Passport">Passport</option>
                                    <option value="Voter ID">Voter ID Card</option>
                                    <option value="Employee ID">Employee ID Card</option>
                                    <option value="Other">Other Government ID</option>
                                </select>
                            </div>
                            <div className="form-field">
                                <label>ID Card Number <span className="required-indicator">*</span></label>
                                <input 
                                    name="idCardNumber" 
                                    value={formData.idCardNumber} 
                                    onChange={handleChange} 
                                    placeholder={getIdCardInfo(formData.idCardType).placeholder}
                                    maxLength={getIdCardInfo(formData.idCardType).maxLength}
                                    required 
                                />
                                {formData.idCardType && (
                                    <small style={{color: '#666', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block'}}>
                                        {formData.idCardType === 'Aadhar' && '12 digits required'}
                                        {formData.idCardType === 'PAN' && '10 characters: 5 letters + 4 digits + 1 letter'}
                                        {formData.idCardType === 'Driving Licence' && 'Enter your driving licence number as printed on the card'}
                                        {formData.idCardType === 'Passport' && 'Enter passport number from your passport'}
                                        {formData.idCardType === 'Voter ID' && 'Enter voter ID number'}
                                        {formData.idCardType === 'Employee ID' && 'Enter company employee ID'}
                                        {formData.idCardType === 'Other' && 'Enter the ID number as printed on your document'}
                                    </small>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Professional Information Section */}
                    <div className="form-section">
                        <h3 className="section-title">Professional Information</h3>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Designation <span className="optional-indicator">(optional)</span></label>
                                <input name="designation" value={formData.designation} onChange={handleChange} />
                            </div>
                            <div className="form-field">
                                <label>
                                    Company <span className="optional-indicator">(optional)</span>
                                    {/* {fromQRScan && formData.company && (
                                        <span className="qr-filled-indicator"> (Auto-filled from QR)</span>
                                    )} */}
                                </label>
                                <input 
                                    name="company" 
                                    value={formData.company} 
                                    onChange={handleChange} 
                                    className={fromQRScan && formData.company ? "qr-auto-filled" : ""}
                                />
                            </div>
                            <div className="form-field">
                                <label>Company Tel <span className="optional-indicator">(optional)</span></label>
                                <input name="companyTel" value={formData.companyTel} onChange={handleChange} />
                            </div>
                            <div className="form-field">
                                <label>Website <span className="optional-indicator">(optional)</span></label>
                                <input name="website" value={formData.website} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-field">
                            <label>Address <span className="optional-indicator">(optional)</span></label>
                            <textarea name="address" value={formData.address} onChange={handleChange} rows="3" />
                        </div>
                    </div>

                    {/* Visit Information Section */}
                    <div className="form-section">
                        <h3 className="section-title">Visit Information</h3>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>
                                    Host Name <span className="required-indicator">*</span>
                                    {/* {fromQRScan && formData.hostName && (
                                        <span className="qr-filled-indicator"> (Auto-filled from QR)</span>
                                    )} */}
                                </label>
                                {userRole === 'admin' ? (
                                    <select 
                                        name="hostName" 
                                        value={formData.hostName} 
                                        onChange={handleChange} 
                                        className={fromQRScan && formData.hostName ? "qr-auto-filled" : ""}
                                        required
                                    >
                                        <option value="" disabled>-- Select a Host --</option>
                                        {hosts.map(host => (
                                            <option key={host.id} value={host.name}>{host.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        name="hostName" 
                                        value={formData.hostName} 
                                        className={fromQRScan && formData.hostName ? "qr-auto-filled" : ""}
                                        readOnly 
                                        required 
                                    />
                                )}
                            </div>
                            <div className="form-field">
                                <label>
                                    Reason for Visit <span className="required-indicator">*</span>
                                    {/* {fromQRScan && formData.reason && (
                                        <span className="qr-filled-indicator"> (Auto-filled from QR)</span>
                                    )} */}
                                </label>
                                <select 
                                    name="reason" 
                                    value={formData.reason} 
                                    onChange={handleChange} 
                                    className={fromQRScan && formData.reason ? "qr-auto-filled" : ""}
                                    required
                                >
                                    <option value="" disabled>-- Select a Reason --</option>
                                    <option value="Interview">Interview</option>
                                    <option value="Client Meeting">Client Meeting</option>
                                    <option value="Contractor">Contractor</option>
                                    <option value="Guest">Guest</option>
                                    <option value="Vendor/Supplier Visit">Vendor/Supplier Visit</option>
                                    <option value="Business Partnership/Collaboration">Business Partnership/Collaboration</option>
                                    <option value="Training/Workshop">Training/Workshop</option>
                                    <option value="Official Audit/Inspection">Official Audit/Inspection</option>
                                    <option value="Facility Tour/Investor Visit">Facility Tour/Investor Visit</option>
                                    <option value="Technical Service or Maintenance">Technical Service or Maintenance</option>
                                    {/* Show QR scanned value as an option if it doesn't match any existing option */}
                                    {fromQRScan && preRegData.reason && !["Interview", "Client Meeting", "Contractor", "Guest", "Vendor/Supplier Visit", "Business Partnership/Collaboration", "Training/Workshop", "Official Audit/Inspection", "Facility Tour/Investor Visit", "Technical Service or Maintenance"].includes(preRegData.reason) && (
                                        <option value={preRegData.reason} style={{backgroundColor: '#fff3cd', fontStyle: 'italic'}}>
                                            🔍 {preRegData.reason} (From QR Scan)
                                        </option>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="form-field">
                            <label>Items/Belongings Being Carried</label>
                            <textarea name="itemsCarried" value={formData.itemsCarried} onChange={handleChange} rows="3" />
                        </div>
                    </div>

                    {/* Photo Capture Section */}
                    <div className="form-section">
                        <h3 className="section-title">Photo Documentation</h3>
                        
                        <div className="camera-section">
                            <h4>Visitor Photo</h4>
                            <div className="camera-controls">
                                <button type="button" className="btn-secondary" onClick={() => setIsCameraOn(true)}>
                                    📷 Start Camera
                                </button>
                                <input type="file" name="photo" accept="image/*" onChange={handleChange} />
                            </div>
                            
                            {isCameraOn && (
                                <div className="video-container">
                                    <video ref={videoRef} autoPlay playsInline />
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    <div className="camera-controls">
                                        <button type="button" className="btn-success" onClick={handleCapture}>
                                            📸 Capture
                                        </button>
                                        <button type="button" className="btn-danger" onClick={() => setIsCameraOn(false)}>
                                            ❌ Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {formData.photo && (
                                <div className="photo-preview">
                                    <img src={formData.photo} alt="Visitor Preview" />
                                </div>
                            )}
                        </div>

                        <div className="camera-section">
                            <h4>ID Card Photo</h4>
                                
                           
                            
                            <div className="camera-controls">
                                <button type="button" className="btn-secondary" onClick={() => setIsIdCardCameraOn(true)}>
                                    📷 Start ID Camera
                                </button>
                                <input type="file" name="idCardPhoto" accept="image/*" onChange={handleChange} />

                            </div>
                            

                            {isIdCardCameraOn && (
                                <div className="video-container">
                                    <video ref={idCardVideoRef} autoPlay playsInline />
                                    <canvas ref={idCardCanvasRef} style={{ display: 'none' }} />
                                    <div className="camera-controls">
                                        <button type="button" className="btn-success" onClick={handleIdCardCapture}>
                                            📸 Capture ID
                                        </button>
                                        <button type="button" className="btn-danger" onClick={() => setIsIdCardCameraOn(false)}>
                                            ❌ Cancel
                                        </button>
                                        
                                    </div>
                                    
                                </div>
                            )}
                            
                            
                            {formData.idCardPhoto && (
                                <div className="photo-preview">
                                    <img src={formData.idCardPhoto} alt="ID Card Preview" />
                                    <div className="camera-controls">
                                        <button type="button" className="btn-secondary" onClick={() => extractIdNumberFromImage(formData.idCardPhoto)}>
                                            🔍 Extract ID Number
                                        </button>
                                    </div>
                                    {formData.idCardNumber && formData.idCardType && (
                                        <div style={{
                                            marginTop: '0.5rem', 
                                            padding: '0.75rem', 
                                            background: 'rgba(40, 167, 69, 0.1)', 
                                            borderRadius: '8px',
                                            border: '1px solid rgba(40, 167, 69, 0.2)'
                                        }}>
                                            <div style={{fontSize: '0.9rem', color: '#155724'}}>
                                                <strong>🆔 Detected:</strong> {formData.idCardType}
                                                <br />
                                                <strong>📝 Number:</strong> {formData.idCardNumber}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {message && <div className="visitor-checkin-success">{message}</div>}
                    {error && <div className="visitor-checkin-error">{error}</div>}
                    
                    <button type="submit" className="submit-button">
                        ✅ Complete Check-In
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VisitorCheckInPage;
