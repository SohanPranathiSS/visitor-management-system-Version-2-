import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';


import { 
  getSystemSettings, 
  updateSystemSettings, 
  getUsers, 
  createAdminUser, 
  updateUser, 
  deleteUser,
  exportSystemData,
  importSystemData,
  getAuditLogs,
  getSystemBackups,
  createBackup,
  restoreBackup
} from '../utils/apiService';
// import AdminSidebar from '../components/AdminSidebar';
import '../styles/SystemAdminPage.css';
import '../styles/AdminDashboardPage.css';
// import '../styles/AdminSidebar.css';

const SystemAdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Settings state
  const [settings, setSettings] = useState({
    companyName: '',
    companyLogo: '',
    systemTimezone: '',
    maxVisitDuration: 8,
    autoCheckoutEnabled: true,
    autoCheckoutHours: 24,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    requirePhotoCapture: true,
    requireSignature: false,
    allowWalkIns: true,
    maxDailyVisitors: 500,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    weekendAccess: false,
    securityLevel: 'medium',
    dataRetentionDays: 365,
    backupFrequency: 'daily',
    maintenanceMode: false
  });

  // Users state
  const [users, setUsers] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
      const [activeSection, setActiveSection] = useState('dashboard');
  
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'host',
    department: '',
    isActive: true
  });

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    user: ''
  });

  // Backup state
  const [backups, setBackups] = useState([]);
  const [backupProgress, setBackupProgress] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'backup') {
      fetchBackups();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const settingsData = await getSystemSettings();
      setSettings(settingsData);
    } catch (err) {
      setError('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersData = await getUsers();
      setUsers(usersData);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const logsData = await getAuditLogs(auditFilters);
      setAuditLogs(logsData);
    } catch (err) {
      setError('Failed to load audit logs');
    }
  };

  const fetchBackups = async () => {
    try {
      const backupsData = await getSystemBackups();
      setBackups(backupsData);
    } catch (err) {
      setError('Failed to load backups');
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await updateSystemSettings(settings);
      setMessage('Settings updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingUser) {
        await updateUser(editingUser.id, userForm);
        setMessage('User updated successfully!');
      } else {
        await createAdminUser(userForm);
        setMessage('User created successfully!');
      }
      
      setShowUserForm(false);
      setEditingUser(null);
      setUserForm({
        username: '',
        email: '',
        password: '',
        role: 'host',
        department: '',
        isActive: true
      });
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department || '',
      isActive: user.isActive
    });
    setShowUserForm(true);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await deleteUser(userId);
      setMessage('User deleted successfully!');
      fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const exportData = await exportSystemData();
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vms-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage('Data exported successfully!');
    } catch (err) {
      setError('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.confirm('Importing data will overwrite existing data. Continue?')) return;

    try {
      setLoading(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      await importSystemData(data);
      setMessage('Data imported successfully!');
      
      // Reload all data
      loadInitialData();
      fetchUsers();
    } catch (err) {
      setError('Failed to import data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupProgress(0);
      setLoading(true);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await createBackup();
      
      clearInterval(progressInterval);
      setBackupProgress(100);
      setMessage('Backup created successfully!');
      fetchBackups();
      
      setTimeout(() => setBackupProgress(0), 2000);
    } catch (err) {
      setError('Failed to create backup');
      setBackupProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    if (!window.confirm('Restoring backup will overwrite current data. Continue?')) return;

    try {
      setLoading(true);
      await restoreBackup(backupId);
      setMessage('System restored successfully!');
      loadInitialData();
    } catch (err) {
      setError('Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
                                <Link to="/advanced-visitors" className="sidebar-link">
                                  👥 Advanced Visitor Features
                                </Link>
                              </li>
                              <li>
                                <Link to="/system-admin" className="sidebar-link active system-admin-active">
                                  ⚙️ System Administration
                                </Link>
                              </li>
                            </ul>
                          </aside>
        <div className="system-admin-container">
          <div className="system-admin-header">
            <h1>System Administration</h1>
            <p>Manage system settings, users, and data</p>
          </div>

      <div className="system-admin-tabs">
        <button 
          className={activeTab === 'settings' ? 'active' : ''} 
          onClick={() => setActiveTab('settings')}
        >
          System Settings
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button 
          className={activeTab === 'audit' ? 'active' : ''} 
          onClick={() => setActiveTab('audit')}
        >
          Audit Logs
        </button>
        <button 
          className={activeTab === 'backup' ? 'active' : ''} 
          onClick={() => setActiveTab('backup')}
        >
          Backup & Restore
        </button>
        <button 
          className={activeTab === 'maintenance' ? 'active' : ''} 
          onClick={() => setActiveTab('maintenance')}
        >
          Maintenance
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div className="system-admin-content">
        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h2>System Settings</h2>
            <form onSubmit={handleSettingsSubmit} className="settings-form">
              <div className="settings-section">
                <h3>Company Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Company Name</label>
                    <input
                      type="text"
                      name="companyName"
                      value={settings.companyName}
                      onChange={handleSettingsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Company Logo URL</label>
                    <input
                      type="url"
                      name="companyLogo"
                      value={settings.companyLogo}
                      onChange={handleSettingsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>System Timezone</label>
                    <select
                      name="systemTimezone"
                      value={settings.systemTimezone}
                      onChange={handleSettingsChange}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Asia/Kolkata">India Standard Time</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Visit Management</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Max Visit Duration (hours)</label>
                    <input
                      type="number"
                      name="maxVisitDuration"
                      value={settings.maxVisitDuration}
                      onChange={handleSettingsChange}
                      min="1"
                      max="24"
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Daily Visitors</label>
                    <input
                      type="number"
                      name="maxDailyVisitors"
                      value={settings.maxDailyVisitors}
                      onChange={handleSettingsChange}
                      min="1"
                    />
                  </div>
                  <div className="form-group">
                    <label>Auto Checkout Hours</label>
                    <input
                      type="number"
                      name="autoCheckoutHours"
                      value={settings.autoCheckoutHours}
                      onChange={handleSettingsChange}
                      min="1"
                      max="72"
                    />
                  </div>
                </div>
                
                <div className="checkbox-grid">
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="autoCheckoutEnabled"
                        checked={settings.autoCheckoutEnabled}
                        onChange={handleSettingsChange}
                      />
                      Enable Auto Checkout
                    </label>
                  </div>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="allowWalkIns"
                        checked={settings.allowWalkIns}
                        onChange={handleSettingsChange}
                      />
                      Allow Walk-in Visitors
                    </label>
                  </div>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="requirePhotoCapture"
                        checked={settings.requirePhotoCapture}
                        onChange={handleSettingsChange}
                      />
                      Require Photo Capture
                    </label>
                  </div>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="requireSignature"
                        checked={settings.requireSignature}
                        onChange={handleSettingsChange}
                      />
                      Require Digital Signature
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Working Hours</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      name="workingHoursStart"
                      value={settings.workingHoursStart}
                      onChange={handleSettingsChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      name="workingHoursEnd"
                      value={settings.workingHoursEnd}
                      onChange={handleSettingsChange}
                    />
                  </div>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="weekendAccess"
                        checked={settings.weekendAccess}
                        onChange={handleSettingsChange}
                      />
                      Allow Weekend Access
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Notifications</h3>
                <div className="checkbox-grid">
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="emailNotificationsEnabled"
                        checked={settings.emailNotificationsEnabled}
                        onChange={handleSettingsChange}
                      />
                      Email Notifications
                    </label>
                  </div>
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="smsNotificationsEnabled"
                        checked={settings.smsNotificationsEnabled}
                        onChange={handleSettingsChange}
                      />
                      SMS Notifications
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Security & Data</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Security Level</label>
                    <select
                      name="securityLevel"
                      value={settings.securityLevel}
                      onChange={handleSettingsChange}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Data Retention (days)</label>
                    <input
                      type="number"
                      name="dataRetentionDays"
                      value={settings.dataRetentionDays}
                      onChange={handleSettingsChange}
                      min="30"
                      max="2555"
                    />
                  </div>
                  <div className="form-group">
                    <label>Backup Frequency</label>
                    <select
                      name="backupFrequency"
                      value={settings.backupFrequency}
                      onChange={handleSettingsChange}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="maintenanceMode"
                      checked={settings.maintenanceMode}
                      onChange={handleSettingsChange}
                    />
                    Maintenance Mode
                  </label>
                </div>
              </div>

              <button type="submit" disabled={loading} className="save-btn">
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="users-header">
              <h2>User Management</h2>
              <button onClick={() => setShowUserForm(true)} className="add-user-btn">
                Add New User
              </button>
            </div>

            {showUserForm && (
              <div className="user-form-modal">
                <div className="user-form-content">
                  <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
                  <form onSubmit={handleUserSubmit}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Username *</label>
                        <input
                          type="text"
                          name="username"
                          value={userForm.username}
                          onChange={handleUserChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Email *</label>
                        <input
                          type="email"
                          name="email"
                          value={userForm.email}
                          onChange={handleUserChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Password {editingUser ? '(leave blank to keep current)' : '*'}</label>
                        <input
                          type="password"
                          name="password"
                          value={userForm.password}
                          onChange={handleUserChange}
                          required={!editingUser}
                        />
                      </div>
                      <div className="form-group">
                        <label>Role *</label>
                        <select
                          name="role"
                          value={userForm.role}
                          onChange={handleUserChange}
                          required
                        >
                          <option value="host">Host</option>
                          <option value="admin">Admin</option>
                          <option value="security">Security</option>
                          <option value="receptionist">Receptionist</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Department</label>
                        <input
                          type="text"
                          name="department"
                          value={userForm.department}
                          onChange={handleUserChange}
                        />
                      </div>
                      <div className="checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            name="isActive"
                            checked={userForm.isActive}
                            onChange={handleUserChange}
                          />
                          Active User
                        </label>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                      </button>
                      <button type="button" onClick={() => {
                        setShowUserForm(false);
                        setEditingUser(null);
                        setUserForm({
                          username: '',
                          email: '',
                          password: '',
                          role: 'host',
                          department: '',
                          isActive: true
                        });
                      }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{user.department || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                      <td>
                        <div className="user-actions">
                          <button onClick={() => handleEditUser(user)} className="edit-btn">
                            Edit
                          </button>
                          <button onClick={() => handleDeleteUser(user.id)} className="delete-btn">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="audit-tab">
            <h2>Audit Logs</h2>
            
            <div className="audit-filters">
              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={auditFilters.startDate}
                  onChange={(e) => setAuditFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={auditFilters.endDate}
                  onChange={(e) => setAuditFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div className="filter-group">
                <label>Action</label>
                <select
                  value={auditFilters.action}
                  onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))}
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="visitor_checkin">Visitor Check-in</option>
                  <option value="visitor_checkout">Visitor Check-out</option>
                  <option value="settings_update">Settings Update</option>
                  <option value="user_create">User Create</option>
                  <option value="user_update">User Update</option>
                  <option value="user_delete">User Delete</option>
                </select>
              </div>
              <button onClick={fetchAuditLogs} className="filter-btn">
                Apply Filters
              </button>
            </div>

            <div className="audit-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>{log.username}</td>
                      <td>
                        <span className={`action-badge ${log.action.replace('_', '-')}`}>
                          {log.action.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>{log.details}</td>
                      <td>{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="backup-tab">
            <h2>Backup & Restore</h2>
            
            <div className="backup-actions">
              <div className="backup-create">
                <h3>Create Backup</h3>
                <p>Create a full system backup including all visitor data, settings, and user information.</p>
                <button onClick={handleCreateBackup} disabled={loading} className="backup-btn">
                  {loading ? 'Creating Backup...' : 'Create Backup'}
                </button>
                
                {backupProgress > 0 && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${backupProgress}%` }}
                    >
                      {backupProgress}%
                    </div>
                  </div>
                )}
              </div>

              <div className="data-export">
                <h3>Data Export/Import</h3>
                <p>Export or import system data in JSON format.</p>
                <div className="export-import-actions">
                  <button onClick={handleExportData} className="export-btn">
                    Export Data
                  </button>
                  <label className="import-btn">
                    Import Data
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="backups-list">
              <h3>Available Backups</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date Created</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(backup => (
                    <tr key={backup.id}>
                      <td>{new Date(backup.createdAt).toLocaleString()}</td>
                      <td>{formatFileSize(backup.size)}</td>
                      <td>
                        <span className="backup-type">{backup.type}</span>
                      </td>
                      <td>
                        <span className={`backup-status ${backup.status}`}>
                          {backup.status}
                        </span>
                      </td>
                      <td>
                        <div className="backup-actions">
                          <button onClick={() => handleRestoreBackup(backup.id)} className="restore-btn">
                            Restore
                          </button>
                          <a href={backup.downloadUrl} className="download-btn">
                            Download
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="maintenance-tab">
            <h2>System Maintenance</h2>
            
            <div className="maintenance-grid">
              <div className="maintenance-card">
                <h3>Database Cleanup</h3>
                <p>Remove old visitor records and optimize database performance.</p>
                <button className="maintenance-action-btn">
                  Run Database Cleanup
                </button>
              </div>

              <div className="maintenance-card">
                <h3>Clear Cache</h3>
                <p>Clear system cache to improve performance and resolve issues.</p>
                <button className="maintenance-action-btn">
                  Clear System Cache
                </button>
              </div>

              <div className="maintenance-card">
                <h3>System Diagnostics</h3>
                <p>Run comprehensive system health check and diagnostics.</p>
                <button className="maintenance-action-btn">
                  Run Diagnostics
                </button>
              </div>

              <div className="maintenance-card">
                <h3>Update Check</h3>
                <p>Check for system updates and security patches.</p>
                <button className="maintenance-action-btn">
                  Check for Updates
                </button>
              </div>

              <div className="maintenance-card">
                <h3>Log Rotation</h3>
                <p>Archive old log files and rotate current logs.</p>
                <button className="maintenance-action-btn">
                  Rotate Logs
                </button>
              </div>

              <div className="maintenance-card">
                <h3>Performance Optimization</h3>
                <p>Optimize database indexes and system performance.</p>
                <button className="maintenance-action-btn">
                  Optimize Performance
                </button>
              </div>
            </div>

            <div className="system-info">
              <h3>System Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>System Version:</label>
                  <span>v2.1.0</span>
                </div>
                <div className="info-item">
                  <label>Database Version:</label>
                  <span>MySQL 8.0.28</span>
                </div>
                <div className="info-item">
                  <label>Server Uptime:</label>
                  <span>15 days, 4 hours</span>
                </div>
                <div className="info-item">
                  <label>Memory Usage:</label>
                  <span>2.1 GB / 8 GB</span>
                </div>
                <div className="info-item">
                  <label>Disk Usage:</label>
                  <span>45 GB / 100 GB</span>
                </div>
                <div className="info-item">
                  <label>Active Sessions:</label>
                  <span>12</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default SystemAdminPage;
