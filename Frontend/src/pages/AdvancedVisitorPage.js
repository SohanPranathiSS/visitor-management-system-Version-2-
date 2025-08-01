import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  preRegisterVisitor, 
  getPreRegistrations, 
  generateVisitorBadge, 
  generatePreRegistrationBadge, 
  getVisitorHistory,
  getRecurringVisits,
  updateRecurringVisit,
  generateRecurringInstances,
  updateVisitorBlacklist
} from '../utils/apiService';
// import AdminSidebar from '../components/AdminSidebar';
import '../styles/AdvancedVisitorPage.css';
import '../styles/AdminDashboardPage.css';
// import '../styles/AdminSidebar.css';

const AdvancedVisitorPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('preregister');
  const [preRegistrations, setPreRegistrations] = useState([]);
  const [recurringVisits, setRecurringVisits] = useState([]);
  const [visitorHistory, setVisitorHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  

  // History filters
  const [historyFilters, setHistoryFilters] = useState({
    startDate: '',
    endDate: '',
    visitorEmail: '',
    hostName: '',
    limit: 100
  });

  // Pre-registration form state
  const [preRegForm, setPreRegForm] = useState({
    visitorName: '',
    visitorEmail: '',
    visitorPhone: '',
    visitorCompany: '',
    hostName: '',
    visitDate: '',
    visitTime: '',
    purpose: '',
    duration: '',
    isRecurring: false,
    recurringPattern: 'weekly',
    recurringEndDate: '',
    specialRequirements: '',
    emergencyContact: '',
    vehicleNumber: '',
    numberOfVisitors: 1
  });

  // QR Code generation state
  const [qrCodeData, setQrCodeData] = useState(null);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (activeTab === 'preregistrations') {
      fetchPreRegistrations();
    } else if (activeTab === 'recurring') {
      fetchRecurringVisits();
    } else if (activeTab === 'history') {
      fetchVisitorHistory();
    }
  }, [activeTab]);

  const fetchPreRegistrations = async () => {
    setLoading(true);
    try {
      const data = await getPreRegistrations();
      setPreRegistrations(data);
    } catch (err) {
      setError('Failed to load pre-registrations');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurringVisits = async () => {
    setLoading(true);
    try {
      const data = await getRecurringVisits();
      setRecurringVisits(data);
    } catch (err) {
      setError('Failed to load recurring visits');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitorHistory = async () => {
    setLoading(true);
    try {
      const data = await getVisitorHistory(historyFilters);
      setVisitorHistory(data);
    } catch (err) {
      setError('Failed to load visitor history');
    } finally {
      setLoading(false);
    }
  };

  const handlePreRegSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await preRegisterVisitor(preRegForm);
      setMessage('Visitor pre-registered successfully!');
      setQrCodeData(result.qrCode);
      setPreRegForm({
        visitorName: '',
        visitorEmail: '',
        visitorPhone: '',
        visitorCompany: '',
        hostName: '',
        visitDate: '',
        visitTime: '',
        purpose: '',
        duration: '',
        isRecurring: false,
        recurringPattern: 'weekly',
        recurringEndDate: '',
        specialRequirements: '',
        emergencyContact: '',
        vehicleNumber: '',
        numberOfVisitors: 1
      });
    } catch (err) {
      setError(err.message || 'Failed to pre-register visitor');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreRegForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateBadge = async (preRegId) => {
    setLoading(true);
    setError('');
    
    try {
      const badgeResponse = await generatePreRegistrationBadge(preRegId);
      setBadgeData(badgeResponse);
      setShowBadgeModal(true);
    } catch (err) {
      setError('Failed to generate visitor badge: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const printBadge = () => {
    if (badgeData && badgeData.html) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Visitor Badge</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${badgeData.html}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const showQRCode = (visitor) => {
    setSelectedVisitor(visitor);
    setShowQRModal(true);
  };

  // Recurring visit management functions
  const updateRecurringStatus = async (id, status) => {
    setLoading(true);
    try {
      await updateRecurringVisit(id, { status });
      setMessage(`Recurring visit ${status} successfully`);
      fetchRecurringVisits(); // Refresh the list
    } catch (err) {
      setError(`Failed to ${status} recurring visit`);
    } finally {
      setLoading(false);
    }
  };

  const editRecurringVisit = async (id, pattern, endDate) => {
    setLoading(true);
    try {
      await updateRecurringVisit(id, { 
        recurringPattern: pattern, 
        recurringEndDate: endDate 
      });
      setMessage('Recurring visit updated successfully');
      fetchRecurringVisits(); // Refresh the list
    } catch (err) {
      setError('Failed to update recurring visit');
    } finally {
      setLoading(false);
    }
  };

  const generateInstances = async (id) => {
    setLoading(true);
    try {
      const result = await generateRecurringInstances(id);
      setMessage(result.message);
      fetchPreRegistrations(); // Refresh pre-registrations
    } catch (err) {
      setError('Failed to generate recurring instances');
    } finally {
      setLoading(false);
    }
  };

  // Blacklist management function
  const handleBlacklistUpdate = async (visitorId, isBlacklisted) => {
    if (!visitorId) {
      setError('Cannot blacklist visitor: Visitor ID not found');
      return;
    }

    // Find the visitor's email from the current history
    const visitor = visitorHistory.find(v => v.visitor_id === visitorId);
    const visitorEmail = visitor?.visitor_email || visitor?.email;

    if (!visitorEmail) {
      setError('Cannot blacklist visitor: Email not found');
      return;
    }

    const confirmMessage = isBlacklisted 
      ? `Are you sure you want to blacklist all visits for "${visitorEmail}"? This will affect all visit records for this email address.`
      : `Are you sure you want to remove "${visitorEmail}" from the blacklist? This will affect all visit records for this email address.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    try {
      const response = await updateVisitorBlacklist(visitorId, isBlacklisted);
      
      // Show detailed message about how many records were affected
      const affectedCount = response.affectedRecords || 1;
      setMessage(`${isBlacklisted ? 'Blacklisted' : 'Unblacklisted'} all visits for ${visitorEmail}. ${affectedCount} record(s) updated.`);
      
      // Refresh the visitor history to show updated status
      if (activeTab === 'history') {
        fetchVisitorHistory();
      }
    } catch (err) {
      console.error('Blacklist update error:', err);
      setError(`Failed to ${isBlacklisted ? 'blacklist' : 'unblacklist'} visitor: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // History filter handlers
  const handleHistoryFilterChange = (e) => {
    const { name, value } = e.target;
    setHistoryFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyHistoryFilters = async () => {
    setLoading(true);
    try {
      const history = await getVisitorHistory(historyFilters);
      setVisitorHistory(history);
    } catch (error) {
      console.error('Error fetching visitor history:', error);
      setError('Error fetching visitor history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistoryFilters = async () => {
    // Reset all filters to their default values
    setHistoryFilters({
      startDate: '',
      endDate: '',
      visitorEmail: '',
      hostName: '',
      limit: 100
    });

    // Fetch visitor history with cleared filters
    setLoading(true);
    try {
      const history = await getVisitorHistory({
        startDate: '',
        endDate: '',
        visitorEmail: '',
        hostName: '',
        limit: 100
      });
      setVisitorHistory(history);
      setMessage('Filters cleared successfully');
    } catch (error) {
      console.error('Error fetching visitor history:', error);
      setError('Error fetching visitor history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatVisitStatus = (visit) => {
    // Use the status calculated by the backend if available
    if (visit.status) {
      switch (visit.status) {
        case 'completed': return 'Completed';
        case 'in_progress': return 'In Progress';
        case 'scheduled': return 'Scheduled';
        case 'missed': return 'Missed';
        default: return 'expected';
      }
    }
    
    // Fallback logic for manual status calculation
    if (visit.check_out_time) return 'Completed';
    if (visit.check_in_time) return 'In Progress';
    
    // Check if visit date/time is in the future
    const visitDateTime = new Date(`${visit.visit_date} ${visit.visit_time}`);
    if (visitDateTime > new Date()) return 'Scheduled';
    
    return 'Missed';
  };


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    // No need to reload, the router will handle the redirect.
  };

  // Navigation functions
  const navigateToDashboard = () => {
    navigate('/admin');
  };

  const navigateToUsers = () => {
    navigate('/admin', { 
      state: { activeSection: 'users' }
    });
  };

  const navigateToVisitors = () => {
    navigate('/admin', { 
      state: { activeSection: 'visitors' }
    });
  };

  return (
    <div className="admin-page-with-sidebar">
      {/* <AdminSidebar /> */}
            <nav className="navbar">
                    <div className="navbar-logo">Visitor Management</div>
                    <ul className="navbar-links">
                      <li><Link to="/">Home</Link></li>
                      <li><Link to="/products">Products</Link></li>
                      <li><Link to="/resources">Resources</Link></li>
                      <li><Link to="/aboutus">About Us</Link></li>
                      <li><Link to="/bookademo">Book a Demo</Link></li>
                      <li><Link to="/contactus">Contact Us</Link></li>
                      <li><button onClick={handleLogout} className="login-btn">Logout</button></li>
                    </ul>
                  </nav>
      <div className="admin-main-content">
                <div className="admin-dashboard-wrapper">
          <aside className="admin-sidebar">
                            <h3 className="sidebar-title">Admin Panel</h3>
                            <ul className="sidebar-menu">
                              <li>
                                <button 
                                  className="sidebar-menu-btn" 
                                  onClick={navigateToDashboard}
                                >
                                 📊 Dashboard
                                </button>
                              </li>
                              <li>
                                <button 
                                  className="sidebar-menu-btn" 
                                  onClick={navigateToUsers}
                                >
                                  📋 Visitor Logs
                                </button>
                              </li>
                              <li>
                                <button 
                                  className="sidebar-menu-btn" 
                                  onClick={navigateToVisitors}
                                >
                                  👥 Manage Users 
                                </button>
                              </li>
                              <li>
                                <Link to="/reports" className="sidebar-link">
                                  📊 Reports & Analytics
                                </Link>
                              </li>
                              <li>
                                <Link to="/advanced-visitors" className="sidebar-link active advanced-visitors-active">
                                  👥 Advanced Visitor Features
                                </Link>
                              </li>
                              <li>
                                <Link to="/system-admin" className="sidebar-link">
                                  ⚙️ System Administration
                                </Link>
                              </li>
                            </ul>
                          </aside>
        <div className="advanced-visitor-container">
          <div className="advanced-visitor-header">
            <h1>Advanced Visitor Management</h1>
            <p>Pre-register visitors, generate QR codes, and manage recurring visits</p>
          </div>

      <div className="advanced-visitor-tabs">
        <button 
          className={activeTab === 'preregister' ? 'active' : ''} 
          onClick={() => setActiveTab('preregister')}
        >
          Pre-Register Visitor
        </button>
        <button 
          className={activeTab === 'preregistrations' ? 'active' : ''} 
          onClick={() => setActiveTab('preregistrations')}
        >
          Pre-Registrations
        </button>
        <button 
          className={activeTab === 'qrcode' ? 'active' : ''} 
          onClick={() => setActiveTab('qrcode')}
        >
          QR Code Generator
        </button>
        <button 
          className={activeTab === 'recurring' ? 'active' : ''} 
          onClick={() => setActiveTab('recurring')}
        >
          Recurring Visits
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          Visitor History
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div className="advanced-visitor-content">
        {activeTab === 'preregister' && (
          <div className="preregister-tab">
            <h2>Pre-Register Visitor</h2>
            <form onSubmit={handlePreRegSubmit} className="preregister-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Visitor Name *</label>
                  <input
                    type="text"
                    name="visitorName"
                    value={preRegForm.visitorName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="visitorEmail"
                    value={preRegForm.visitorEmail}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="visitorPhone"
                    value={preRegForm.visitorPhone}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    name="visitorCompany"
                    value={preRegForm.visitorCompany}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Host Name *</label>
                  <input
                    type="text"
                    name="hostName"
                    value={preRegForm.hostName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Visit Date *</label>
                  <input
                    type="date"
                    name="visitDate"
                    value={preRegForm.visitDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Visit Time *</label>
                  <input
                    type="time"
                    name="visitTime"
                    value={preRegForm.visitTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Expected Duration (hours)</label>
                  <input
                    type="number"
                    name="duration"
                    value={preRegForm.duration}
                    onChange={handleInputChange}
                    min="0.5"
                    step="0.5"
                  />
                </div>
                <div className="form-group">
                  <label>Number of Visitors</label>
                  <input
                    type="number"
                    name="numberOfVisitors"
                    value={preRegForm.numberOfVisitors}
                    onChange={handleInputChange}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    value={preRegForm.vehicleNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Purpose of Visit *</label>
                <select
                  name="purpose"
                  value={preRegForm.purpose}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Purpose</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Interview">Interview</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Training">Training</option>
                  <option value="Audit">Audit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Emergency Contact</label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={preRegForm.emergencyContact}
                  onChange={handleInputChange}
                  placeholder="Name and phone number"
                />
              </div>

              <div className="form-group full-width">
                <label>Special Requirements</label>
                <textarea
                  name="specialRequirements"
                  value={preRegForm.specialRequirements}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Wheelchair access, dietary requirements, etc."
                />
              </div>

              <div className="recurring-section">
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isRecurring"
                      checked={preRegForm.isRecurring}
                      onChange={handleInputChange}
                    />
                    Recurring Visit
                  </label>
                </div>

                {preRegForm.isRecurring && (
                  <div className="recurring-options">
                    <div className="form-group">
                      <label>Recurring Pattern</label>
                      <select
                        name="recurringPattern"
                        value={preRegForm.recurringPattern}
                        onChange={handleInputChange}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input
                        type="date"
                        name="recurringEndDate"
                        value={preRegForm.recurringEndDate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Processing...' : 'Pre-Register Visitor'}
              </button>
            </form>

            {qrCodeData && (
              <div className="qr-code-section">
                <h3>QR Code Generated</h3>
                <div className="qr-code-container">
                  <QRCodeSVG value={qrCodeData} size={200} />
                  <p>Share this QR code with the visitor for quick check-in</p>
                  <button onClick={() => window.print()} className="print-btn">
                    Print QR Code
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'preregistrations' && (
          <div className="preregistrations-tab">
            <h2>Pre-Registered Visitors</h2>
            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div className="preregistrations-list">
                {preRegistrations.map(visit => (
                  <div key={visit.id} className="prereg-card">
                    <div className="prereg-header">
                      <h3>{visit.visitor_name}</h3>
                      <span className={`status ${formatVisitStatus(visit).toLowerCase()}`}>
                        {formatVisitStatus(visit)}
                      </span>
                    </div>
                    <div className="prereg-details">
                      <p><strong>Host:</strong> {visit.host_name}</p>
                      <p><strong>Date:</strong> {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'Invalid Date'}</p>
                      <p><strong>Time:</strong> {visit.visit_time}</p>
                      <p><strong>Purpose:</strong> {visit.purpose}</p>
                      {visit.visitor_company && (
                        <p><strong>Company:</strong> {visit.visitor_company}</p>
                      )}
                      {visit.visitor_phone && (
                        <p><strong>Phone:</strong> {visit.visitor_phone}</p>
                      )}
                      {visit.number_of_visitors > 1 && (
                        <p><strong>Visitors:</strong> {visit.number_of_visitors}</p>
                      )}
                    </div>
                    <div className="prereg-actions">
                      <button 
                        onClick={() => generateBadge(visit.id)} 
                        className="badge-btn"
                        disabled={loading}
                      >
                        {loading ? 'Generating...' : 'Generate Badge'}
                      </button>
                      {visit.qr_code && (
                        <button 
                          onClick={() => showQRCode(visit)} 
                          className="qr-btn"
                        >
                          View QR Code
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'qrcode' && (
          <div className="qrcode-tab">
            <h2>QR Code Generator</h2>
            <p>Generate QR codes for quick visitor check-in. Click "View QR Code" on any pre-registered visitor to see their QR code.</p>
            
            <div className="qr-instructions">
              <h3>How to use QR Codes:</h3>
              <ul>
                <li>Each pre-registered visitor receives a unique QR code</li>
                <li>Visitors can scan the QR code at reception for quick check-in</li>
                <li>QR codes contain visitor information and visit details</li>
                <li>Print QR codes and include them in visitor confirmation emails</li>
              </ul>
            </div>

            {preRegistrations.length > 0 && (
              <div className="qr-quick-access">
                <h3>Quick QR Access:</h3>
                <div className="qr-visitor-list">
                  {preRegistrations.slice(0, 5).map(visitor => (
                    <div key={visitor.id} className="qr-visitor-item">
                      <span>{visitor.visitor_name} - {visitor.visit_date}</span>
                      <button 
                        onClick={() => showQRCode(visitor)} 
                        className="qr-btn-small"
                      >
                        View QR
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recurring' && (
          <div className="recurring-tab">
            <h2>Recurring Visits Management</h2>
            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div className="recurring-visits">
                {recurringVisits.length === 0 ? (
                  <div className="no-data">
                    <p>No recurring visits found. Create a pre-registration with recurring pattern to see them here.</p>
                  </div>
                ) : (
                  recurringVisits.map(visit => (
                    <div key={visit.id} className="recurring-card">
                      <div className="recurring-header">
                        <h3>{visit.visitor_name}</h3>
                        <span className={`recurring-status ${visit.recurring_status}`}>
                          {visit.recurring_status}
                        </span>
                      </div>
                      <div className="recurring-details">
                        <p><strong>Email:</strong> {visit.visitor_email}</p>
                        <p><strong>Host:</strong> {visit.host_name}</p>
                        <p><strong>Purpose:</strong> {visit.purpose}</p>
                        <p><strong>Pattern:</strong> {visit.recurring_pattern}</p>
                        <p><strong>Original Date:</strong> {new Date(visit.visit_date).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> {visit.visit_time}</p>
                        <p><strong>Next Visit:</strong> {new Date(visit.next_visit_date).toLocaleDateString()}</p>
                        <p><strong>End Date:</strong> {visit.recurring_end_date ? new Date(visit.recurring_end_date).toLocaleDateString() : 'No end date'}</p>
                        {visit.special_requirements && (
                          <p><strong>Special Requirements:</strong> {visit.special_requirements}</p>
                        )}
                      </div>
                      <div className="recurring-actions">
                        <button 
                          onClick={() => generateInstances(visit.id)} 
                          className="generate-btn"
                          disabled={loading}
                        >
                          Generate Instances
                        </button>
                        <button 
                          onClick={() => updateRecurringStatus(visit.id, 'paused')} 
                          className="pause-btn"
                          disabled={loading}
                        >
                          Pause
                        </button>
                        <button 
                          onClick={() => updateRecurringStatus(visit.id, 'stopped')} 
                          className="stop-btn"
                          disabled={loading}
                        >
                          Stop Recurring
                        </button>
                        <button 
                          onClick={() => showQRCode(visit)} 
                          className="qr-btn"
                        >
                          View QR Code
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <h2>Visitor History</h2>
            
            {/* History Filters */}
            <div className="history-filters">
              <h3>Filter History</h3>
              <div className="filter-row">
                <div className="filter-item">
                  <label>Start Date:</label>
                  <input
                    type="date"
                    name="startDate"
                    value={historyFilters.startDate}
                    onChange={handleHistoryFilterChange}
                  />
                </div>
                <div className="filter-item">
                  <label>End Date:</label>
                  <input
                    type="date"
                    name="endDate"
                    value={historyFilters.endDate}
                    onChange={handleHistoryFilterChange}
                  />
                </div>
                <div className="filter-item">
                  <label>Visitor Email:</label>
                  <input
                    type="text"
                    name="visitorEmail"
                    value={historyFilters.visitorEmail}
                    onChange={handleHistoryFilterChange}
                    placeholder="Search by email..."
                  />
                </div>
                <div className="filter-item">
                  <label>Host Name:</label>
                  <input
                    type="text"
                    name="hostName"
                    value={historyFilters.hostName}
                    onChange={handleHistoryFilterChange}
                    placeholder="Search by host..."
                  />
                </div>
                <div className="filter-item">
                  <label>Limit:</label>
                  <select
                    name="limit"
                    value={historyFilters.limit}
                    onChange={handleHistoryFilterChange}
                  >
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                  </select>
                </div>
                <div className="filter-item">
                  <button onClick={applyHistoryFilters} className="apply-filter-btn">
                    Apply Filters
                  </button>
                </div>
                <div className="filter-item">
                  <button onClick={clearHistoryFilters} className="clear-filter-btn">
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div className="history-table-container">
                {visitorHistory.length === 0 ? (
                  <div className="no-data">
                    <p>No visitor history found for the selected criteria.</p>
                  </div>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Visitor</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Host</th>
                        <th>Purpose</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Actions</th>
                        <th>BlackList</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitorHistory.map(visit => (
                        <tr key={visit.id}>
                          <td>
                            <div className="datetime-cell">
                              <div>{visit.check_in_time ? new Date(visit.check_in_time).toLocaleDateString() : 'N/A'}</div>
                              <div className="time">{visit.check_in_time ? new Date(visit.check_in_time).toLocaleTimeString() : 'N/A'}</div>
                            </div>
                          </td>
                          <td className="visitor-cell">
                            <strong>{visit.visitor_name || visit.name || 'Unknown'}</strong>
                            {visit.is_blacklisted && (
                              <span className="blacklisted-indicator">🚫 Blacklisted</span>
                            )}
                          </td>
                          <td>{visit.visitor_email || visit.email || 'N/A'}</td>
                          <td>{visit.visitor_company || visit.company || 'N/A'}</td>
                          <td>{visit.host_name || visit.name || 'Unknown'}</td>
                          <td>{visit.purpose || visit.reason || 'N/A'}</td>
                          <td>
                            {visit.check_out_time && visit.check_in_time ? 
                              Math.round((new Date(visit.check_out_time) - new Date(visit.check_in_time)) / (1000 * 60)) + ' min' :
                              visit.check_in_time ? 'In Progress' : 'Not Started'
                            }
                          </td>
                          <td>
                            <span className={`status ${visit.status || 'unknown'}`}>
                              {visit.status || 'Unknown'}
                            </span>
                          </td>
                          <td>
                            <div className="history-actions">
                              {visit.qr_code && (
                                <button 
                                  onClick={() => showQRCode(visit)} 
                                  className="qr-btn-small"
                                  title="View QR Code"
                                >
                                  QR
                                </button>
                              )}
                              <button 
                                onClick={() => generateBadge(visit.id)} 
                                className="badge-btn-small"
                                title="Generate Badge"
                              >
                                Badge
                              </button>
                            </div>
                          </td>
                          <td>
                            {visit.is_blacklisted ? ( 
                              <button
                                onClick={() => handleBlacklistUpdate(visit.visitor_id, false)}
                                className="blacklist-btn unblacklist"
                                disabled={loading || !visit.visitor_id}
                                title={!visit.visitor_id ? 'Visitor ID not available' : `Remove ${visit.visitor_email || visit.email || 'this email'} from blacklist (affects all visits)`}
                              >
                                Unblacklist
                                </button>
                                ) : (
                                  <button
                                  onClick={() => handleBlacklistUpdate(visit.visitor_id, true)}
                                  className="blacklist-btn blacklist"
                                  disabled={loading || !visit.visitor_id}
                                  title={!visit.visitor_id ? 'Visitor ID not available' : `Blacklist ${visit.visitor_email || visit.email || 'this email'} (affects all visits)`}
                                  >
                                Blacklist 
                                  </button>
                                  )
                                  }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Badge Modal */}
      {showBadgeModal && badgeData && (
        <div className="modal-overlay" onClick={() => setShowBadgeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Visitor Badge Preview</h3>
              <button onClick={() => setShowBadgeModal(false)} className="close-btn">
                ×
              </button>
            </div>
            <div className="badge-preview" dangerouslySetInnerHTML={{ __html: badgeData.html }} />
            <div className="modal-actions">
              <button onClick={printBadge} className="print-btn">
                🖨️ Print Badge
              </button>
              <button onClick={() => setShowBadgeModal(false)} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedVisitor && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>QR Code for {selectedVisitor.visitor_name}</h3>
              <button onClick={() => setShowQRModal(false)} className="close-btn">
                ×
              </button>
            </div>
            <div className="qr-code-container">
              <QRCodeSVG value={selectedVisitor.qr_code} size={300} />
              <div className="qr-info">
                <p><strong>Visitor:</strong> {selectedVisitor.visitor_name}</p>
                <p><strong>Host:</strong> {selectedVisitor.host_name}</p>
                <p><strong>Date:</strong> {selectedVisitor.visit_date ? new Date(selectedVisitor.visit_date).toLocaleDateString() : 'Invalid Date'}</p>
                <p><strong>Time:</strong> {selectedVisitor.visit_time}</p>
                <p><strong>Purpose:</strong> {selectedVisitor.purpose}</p>
                {selectedVisitor.visitor_company && (
                  <p><strong>Company:</strong> {selectedVisitor.visitor_company}</p>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => window.print()} className="print-btn">
                🖨️ Print QR Code
              </button>
              <button onClick={() => setShowQRModal(false)} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default AdvancedVisitorPage;
