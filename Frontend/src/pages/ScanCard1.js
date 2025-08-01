import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/ScanCard1.css';

const OCR_API_URL = 'http://127.0.0.1:5000/upload';

const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

const ScanCard1 = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { hostName } = location.state || { hostName: 'Host' };

    const [cardImage, setCardImage] = useState(null);
    const [extractedData, setExtractedData] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [prompt, setPrompt] = useState(''); // New state for prompt

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isCameraOn) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isCameraOn]);

    const startCamera = async () => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access the camera. Please check permissions.");
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

    const handleCapture = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const imageDataUrl = canvas.toDataURL('image/png');
            setCardImage(imageDataUrl);
            setExtractedData(null);
            stopCamera();
            setIsCameraOn(false);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCardImage(reader.result);
                setExtractedData(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleScan = async () => {
        if (!cardImage) {
            setError("Please capture or upload a business card first.");
            return;
        }
        setIsLoading(true);
        setError('');
        setExtractedData(null);

        try {
            const imageBlob = dataURLtoBlob(cardImage);
            const formData = new FormData();
            formData.append('file', imageBlob, 'business_card.png');
            formData.append('prompt', prompt); // Include prompt

            const response = await fetch(OCR_API_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error occurred.');
            }

            const data = await response.json();
            console.log("Extracted Data:", data);
            setExtractedData(data);
        } catch (err) {
            setError(`Failed to extract data: ${err.message}`);
            console.error("OCR Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        const prefillData = {
            name: extractedData.name,
            email: extractedData.email,
            phone: extractedData.personal_mobile_number,
            company: extractedData.company,
            designation: extractedData.designation,
            address: extractedData.address,
            website: extractedData.website,
            companyTel: extractedData.company_number,
        };
        console.log("Prefill Data:", prefillData);
        navigate('/checkin', { state: { prefillData, hostName } });
    };

    return (
        <div className="scan-card-container">
            <div className="scan-card-content">
                <h1 className="scan-card-title">Scan Business Card</h1>
                <p className="scan-card-subtitle">Capture or upload an image of the business card.</p>
                
                {/* Prompt Input */}
                <div className="prompt-section">
                    {/* <label htmlFor="prompt" className="prompt-label">What data should be extracted? (Optional)</label>
                    <input
                        type="text"
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., 'Extract the name, address, and items from the receipt'"
                        className="prompt-input"
                    /> */}
                </div>

                {isCameraOn ? (
                    <div className="camera-view">
                        <video ref={videoRef} autoPlay playsInline className="camera-video"></video>
                        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                        <div className="camera-controls">
                            <button onClick={handleCapture} className="control-btn capture-btn">Capture</button>
                            <button onClick={() => {
                                stopCamera();
                                setIsCameraOn(false);
                            }} className="control-btn cancel-btn">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="action-buttons">
                            <button onClick={() => setIsCameraOn(true)} className="action-btn scan-btn">Scan with Camera</button>
                            <button onClick={handleUploadClick} className="action-btn upload-btn">Upload Image</button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                        </div>

                        {cardImage && (
                            <div className="image-preview-section">
                                <h2 className="section-title">Preview</h2>
                                <img src={cardImage} alt="Business Card Preview" className="image-preview" />
                                <button onClick={handleScan} className="action-btn process-btn" disabled={isLoading}>
                                    {isLoading ? 'Scanning...' : 'Scan for Details'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {error && <p className="error-message">{error}</p>}

                {extractedData && (
                    <div className="extracted-data-section">
                        <h2 className="section-title">Extracted Information</h2>
                        <div className="data-card">
                            {Object.entries(extractedData).map(([key, value]) => (
                                <p key={key}><strong>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:</strong> {value}</p>
                            ))}
                        </div>
                        <button onClick={handleConfirm} className="action-btn confirm-btn">
                            Confirm and Proceed to Check-In
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScanCard1;