# 🏢 Visitor Management System (VMS) - Advanced ID Card Detection

A comprehensive **full-stack visitor management system** with **AI-powered ID card detection**, QR code scanning, and real-time visitor tracking. Built with **React**, **Node.js**, **MySQL**, and **Flask ML services**.

## 🚀 Key Features

### 🔍 **Advanced ID Card Detection System**
- **7 ID Card Types Supported**: Aadhar, PAN, Driving Licence, Passport, Voter ID, Employee ID, Other Government IDs
- **AI-Powered Auto-Detection**: ML service automatically identifies card type from photos
- **Smart Validation**: Dynamic validation rules based on selected ID card type
- **Database Integration**: Stores ID card type classifications for visitor tracking

### 📱 **QR Code Integration**
- **Pre-registration System**: Generate QR codes for scheduled visits
- **Auto-fill Forms**: QR scan automatically populates visitor check-in form
- **Seamless Workflow**: Scan → Auto-fill → Verify → Check-in

### 🎯 **Core Functionality**
- **Multi-role Support**: Admin, Host, and Visitor roles with appropriate permissions
- **Real-time Dashboard**: Live visitor statistics and analytics
- **Photo Capture**: Visitor and ID card photo documentation
- **Check-in/Check-out Tracking**: Complete visit lifecycle management
- **Blacklist Management**: Security features for unwanted visitors
- **Email Notifications**: Automated notifications for hosts and visitors

### 📊 **Analytics & Reporting**
- **Comprehensive Reports**: Daily, weekly, monthly visitor analytics
- **Host Performance**: Track visits per host
- **Purpose Analytics**: Visit reason categorization and trends
- **Export Capabilities**: PDF and Excel export functionality

## 🛠 Tech Stack

### **Frontend** (React)
- **React 18** with functional components and hooks
- **React Router** for navigation
- **CSS3** with modern styling and responsive design
- **jsQR Library** for QR code scanning
- **Camera Integration** for photo capture

### **Backend** (Node.js/Express)
- **Node.js** with Express framework
- **JWT Authentication** with role-based access control
- **MySQL** database with connection pooling
- **Nodemailer** for email notifications
- **CORS** enabled for cross-origin requests

### **Machine Learning** (Flask/Python)
- **Flask API** for ML service endpoints
- **OCR Processing** with text extraction
- **Keyword Analysis** for automatic ID card type detection
- **Image Processing** with confidence scoring
- **pyzbar** for QR code processing

### **Database** (MySQL)
- **Normalized Schema** with proper relationships
- **Visitor Tracking** with complete audit trail
- **Company-based Isolation** for multi-tenant support
- **ID Card Type Storage** for classification persistence

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **Python** (v3.7 or higher)
- **MySQL** (v8.0 or higher)
- **Git** for version control

## 🚀 Installation & Setup

### 1. **Clone Repository**
```bash
git clone https://github.com/yourusername/visitor-management-system.git
cd visitor-management-system
```

### 2. **Database Setup**
```sql
-- Create database
CREATE DATABASE vms_db;

-- Run the provided database_setup.sql script
mysql -u root -p vms_db < Backend/database_setup.sql
```

### 3. **Backend Setup**
```bash
cd Backend
npm install

# Create .env file with your configuration
# Update with your database credentials and email settings
npm start
```

### 4. **Frontend Setup**
```bash
cd Frontend
npm install
npm start
```

### 5. **ML Service Setup**
```bash
cd ML
pip install -r requirements.txt
python flask_api.py
```

## 🔧 Configuration

### **Environment Variables (.env)**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=vms_db
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

### **Default Ports**
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000
- **ML Service**: http://localhost:5000

## 🎯 Usage Guide

### **1. Company Registration**
- Register your company through the admin registration page
- Verify email address to activate account
- Add hosts and configure system settings

### **2. Visitor Pre-registration**
- Hosts can pre-register visitors with QR codes
- Email invitations sent automatically
- QR codes enable quick check-in

### **3. Check-in Process**
- **Option A**: Scan QR code → Auto-fill form → Verify → Submit
- **Option B**: Manual form entry with ID card detection
- Capture visitor photo and ID card photo
- ML service automatically detects ID card type

### **4. ID Card Detection Workflow**
1. Select ID card type from dropdown (7 options available)
2. Capture ID card photo using camera
3. Click "Extract ID Number" button
4. ML service processes image and detects:
   - Card type (with confidence scoring)
   - ID number extraction
   - Automatic form field population
5. Review and submit visitor information

### **5. Dashboard & Analytics**
- Real-time visitor statistics
- Host performance metrics
- Visit purpose analytics
- Export reports in PDF/Excel format

## 🧪 Testing the ID Card Detection System

### **Test the Complete Workflow:**
1. **Navigate to Visitor Check-in**: http://localhost:3000/visitor-checkin
2. **Fill Basic Information**: Name, email, host selection
3. **ID Card Type Selection**: Choose from 7 available types
4. **Photo Capture**: Use camera to capture ID card
5. **Auto-Detection**: Click "Extract ID Number" to test ML service
6. **Verification**: Review auto-detected card type and number
7. **Submit**: Complete check-in with stored card type in database

### **Supported ID Card Types:**
- **Aadhar Card**: 12-digit number validation
- **PAN Card**: 10-character alphanumeric format
- **Driving Licence**: Variable format support
- **Passport**: International passport numbers
- **Voter ID**: Electoral photo identity card
- **Employee ID**: Company-issued identification
- **Other**: Government-issued IDs

## 📁 Project Structure

```
visitor-management-system/
├── Backend/
│   ├── server.js                 # Main Express server
│   ├── config/database.js        # Database configuration
│   ├── database_setup.sql        # Database schema
│   └── package.json
├── Frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/               # Page components
│   │   ├── styles/              # CSS files
│   │   └── utils/               # API services
│   └── package.json
├── ML/
│   ├── flask_api.py             # Main Flask ML service
│   ├── newLogic.py              # Enhanced ID detection logic
│   ├── requirements.txt         # Python dependencies
│   └── static/uploads/          # Image processing folder
└── README.md
```

## 🔄 Recent Updates

### **Version 3.0 - Advanced ID Card Detection**
- ✅ **7 ID Card Types**: Complete support for all major Indian ID cards
- ✅ **ML Auto-Detection**: Automatic card type identification
- ✅ **Smart Validation**: Dynamic validation based on card type
- ✅ **Database Integration**: Store card type classifications
- ✅ **Enhanced UI**: Visual indicators and confidence feedback
- ✅ **QR Integration**: Seamless QR scan to form auto-fill workflow

### **Key Enhancements:**
- **VisitorCheckInPage.js**: Enhanced with ID card type dropdown and smart validation
- **server.js**: Updated `/api/visits` endpoint with `idCardType` parameter handling
- **newLogic.py**: Advanced ML service with keyword analysis and pattern recognition
- **Database Schema**: Added `type_of_card` column to visitors table

## 🔧 Default Login Credentials

After database setup, use these credentials:

- **Admin**: admin@vms.com / admin123
- **Host**: john@company.com / password123

## 📊 API Endpoints

### **Authentication**
- `POST /api/login` - User login
- `POST /api/registerCompany` - Company registration
- `POST /api/register` - Create new host (admin only)

### **Visitor Management**
- `POST /api/visits` - Create new visit (check-in) with ID card type
- `GET /api/visits` - Get all visits (admin)
- `GET /api/host-visits` - Get host-specific visits
- `PUT /api/visits/:id/checkout` - Check-out visitor

### **Pre-registration & QR**
- `POST /api/visitors/pre-register` - Pre-register visitor
- `POST /api/visitors/qr-checkin` - QR code verification

### **ML Services**
- `POST /extract-id-number` - ID card OCR and type detection

### **Analytics**
- `GET /api/reports` - Get comprehensive reports
- `GET /api/reports/export` - Export reports (PDF/Excel)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔧 Troubleshooting

### **Common Issues:**

1. **Database Connection Error**
   - Ensure MySQL server is running
   - Check credentials in `.env` file
   - Verify database user permissions

2. **ML Service Issues**
   - Check Python dependencies installation
   - Ensure Flask service is running on port 5000
   - Verify image upload permissions

3. **CORS Issues**
   - Backend configured for localhost:3000
   - Check API endpoints are accessible

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** for the amazing frontend framework
- **Express.js** for the robust backend framework
- **MySQL** for reliable database management
- **Flask** for the powerful ML service framework
- **OCR Libraries** for text extraction capabilities

## 📞 Support

For support, email support@vms.com or create an issue in the GitHub repository.

---

**Built with ❤️ for modern visitor management needs**
