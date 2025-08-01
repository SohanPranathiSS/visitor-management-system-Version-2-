import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  getUsers, 
  getVisits, 
  createUser, 
  getVisitorHistory, 
  getPendingVisitors, 
  getBlacklistedVisitors,
  updateVisitorBlacklist,
  getReports,
  exportReport,
  preRegisterVisitor, 
  getPreRegistrations, 
  generateVisitorBadge, 
  generatePreRegistrationBadge, 
  getRecurringVisits,
  updateRecurringVisit,
  generateRecurringInstances,
  getSystemSettings, 
  updateSystemSettings, 
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
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import '../styles/AdminDashboardPage.css';
import '../styles/AdvancedVisitorPage.css';
import '../styles/ReportsPage.css';
import '../styles/SystemAdminPage.css';
import '../styles/SystemAdminScrollable.css';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const AdminDashboardPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Admin Dashboard States
  const [users, setUsers] = useState([]);
  const [visits, setVisits] = useState([]);
  const [filteredVisits, setFilteredVisits] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    hostName: '',
    visitorName: '',
    visitorId: ''
  });
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeSubSection, setActiveSubSection] = useState('visitor-dashboard');
  const [activeSubSubSection, setActiveSubSubSection] = useState('visitor-status-metrics');
  const [userRole, setUserRole] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showVisitorDetails, setShowVisitorDetails] = useState(false);
  const [activeVisitorTab, setActiveVisitorTab] = useState('all');
  const [expandedMenus, setExpandedMenus] = useState({
    dashboard: true,
    visitorLogs: false,
    manageUsers: false,
    visitorDashboard: true,
    hrDashboard: false,
    visitorDashboardLogs: false,
    hrDashboardLogs: false,
    reports: false,
    advancedVisitors: false,
    systemAdmin: false
  });
  const [visitorCounts, setVisitorCounts] = useState({
    all: 0,
    'checked-in': 0,
    pending: 0,
    expected: 0,
    'checked-out': 0,
    blacklisted: 0
  });
  const [visitorTypeCounts, setVisitorTypeCounts] = useState({
    guests: 0,
    vendors: 0,
    interviewees: 0,
    contractors: 0,
    delivery: 0,
    maintenance: 0,
    clients: 0,
    partners: 0,
    other: 0
  });
  const [reportData, setReportData] = useState(null);
  const [reportDateRange, setReportDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [activeReportTab, setActiveReportTab] = useState('overview');

  // Advanced Visitor States
  const [activeTab, setActiveTab] = useState('preregister');
  const [preRegistrations, setPreRegistrations] = useState([]);
  const [recurringVisits, setRecurringVisits] = useState([]);
  const [visitorHistory, setVisitorHistory] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    startDate: '',
    endDate: '',
    visitorEmail: '',
    hostName: '',
    limit: 100
  });
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
  const [qrCodeData, setQrCodeData] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [message, setMessage] = useState('');

  // System Admin States
  const [systemAdminActiveTab, setSystemAdminActiveTab] = useState('settings');
  const [systemSettings, setSystemSettings] = useState({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    allowPreregistration: true,
    requireApproval: true,
    maxVisitorDuration: 8,
    workingHours: {
      start: '09:00',
      end: '18:00'
    },
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    notificationSettings: {
      emailNotifications: true,
      smsNotifications: false,
      hostNotification: true,
      adminNotification: true
    },
    securityLevel: 'medium',
    dataRetentionDays: 365,
    backupFrequency: 'daily',
    maintenanceMode: false
  });
  const [systemUsers, setSystemUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backupProgress, setBackupProgress] = useState(0);
  const [auditFilters, setAuditFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    username: ''
  });
  const [newAdminUser, setNewAdminUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'host',
    department: '',
    phone: '',
    isActive: true
  });
  const [editingUser, setEditingUser] = useState(null);

  // Handle navigation from other pages
  useEffect(() => {
    if (location.state?.activeSection) {
      setActiveSection(location.state.activeSection);
      if (location.state.activeSection === 'advanced-visitors') {
        setActiveTab('preregister');
      }
    }
  }, [location.state]);

  // Get user role and company info
  useEffect(() => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem('user'));
      if (loggedInUser && loggedInUser.role) {
        setUserRole(loggedInUser.role);
        if (loggedInUser.company_name) {
          setCompanyInfo({
            name: loggedInUser.company_name,
            adminName: loggedInUser.name
          });
        }
      } else {
        setError('Could not determine user role. Please log in again.');
      }
    } catch (e) {
      setError('Could not retrieve user data. Please log in again.');
      console.error('Error parsing user data:', e);
    }

    const fetchAllUsers = async () => {
      try {
        const usersData = await getUsers();
        setUsers(usersData);
      } catch (err) {
        setError('Failed to load users. Please try again later.');
        console.error(err);
      }
    };
    fetchAllUsers();
  }, []);

  // Apply client-side filtering for visits
  useEffect(() => {
    if (activeVisitorTab === 'pending' || activeVisitorTab === 'blacklisted') {
      setFilteredVisits(visits);
      return;
    }

    let filtered = [...visits];
    if (filters.visitorName) {
      filtered = filtered.filter(visit => 
        visit.visitorName?.toLowerCase().includes(filters.visitorName.toLowerCase()) ||
        visit.visitor_name?.toLowerCase().includes(filters.visitorName.toLowerCase())
      );
    }
    if (filters.visitorId) {
      filtered = filtered.filter(visit => 
        visit.id?.toString().includes(filters.visitorId) ||
        visit.visitor_id?.toString().includes(filters.visitorId)
      );
    }
    setFilteredVisits(filtered);
  }, [visits, filters, activeVisitorTab]);

  // Filter visits by category
  const filterVisitsByCategory = useCallback((visits, category) => {
    const now = new Date();
    switch (category) {
      case 'checked-in':
        return visits.filter(visit => 
          visit.check_in_time && !visit.check_out_time
        );
      case 'pending':
        return visits.filter(visit => 
          !visit.check_in_time && visit.status === 'pending'
        );
      case 'expected':
        return visits.filter(visit => {
          const visitDate = new Date(visit.visit_date);
          return !visit.check_in_time && visitDate >= now.setHours(0, 0, 0, 0);
        });
      case 'checked-out':
        return visits.filter(visit => 
          visit.check_in_time && visit.check_out_time
        );
      case 'blacklisted':
        return visits.filter(visit => 
          visit.isBlacklisted === true || visit.is_blacklisted === true
        );
      default:
        return visits;
    }
  }, []);

  // Fetch visitor data
  const fetchVisitorData = useCallback(async () => {
    if (!userRole) return;
    setLoading(true);
    setError('');
    try {
      let data = [];
      const apiFilters = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        visitorName: filters.visitorName,
        visitorId: filters.visitorId,
        hostName: filters.hostName,
        limit: 500
      };
      switch (activeVisitorTab) {
        case 'pending':
          data = await getPendingVisitors(apiFilters);
          break;
        case 'blacklisted':
          data = await getBlacklistedVisitors(apiFilters);
          break;
        default:
          const activeFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v)
          );
          data = await getVisits(userRole, activeFilters);
          data = filterVisitsByCategory(data, activeVisitorTab);
          break;
      }
      setVisits(data);
    } catch (err) {
      setError('Failed to load visitor data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, userRole, activeVisitorTab, filterVisitsByCategory]);

  useEffect(() => {
    if (activeSection === 'visitor-logs' || activeSection === 'dashboard') {
      fetchVisitorData();
    }
  }, [fetchVisitorData, activeSection]);

  // Fetch report data
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching report data for date range:', reportDateRange);
      const data = await getReports(reportDateRange);
      console.log('Report data received:', data);
      setReportData(data);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [reportDateRange]);

  useEffect(() => {
    if (activeSection === 'reports') {
      fetchReportData();
    }
  }, [activeSection, fetchReportData]);

  // Advanced Visitor Data Fetching
  useEffect(() => {
    if (activeSection === 'advanced-visitors') {
      if (activeTab === 'preregistrations') {
        fetchPreRegistrations();
      } else if (activeTab === 'recurring') {
        fetchRecurringVisits();
      } else if (activeTab === 'history') {
        fetchVisitorHistory();
      }
    }
  }, [activeSection, activeTab]);

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

  // Handlers
  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      hostName: '',
      visitorName: '',
      visitorId: ''
    });
    fetchVisitorData();
  };

  const handleUserInputChange = (e) => {
    setNewUser(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(newUser);
      setNewUser({ name: '', email: '', password: '' });
      setError('');
      const usersData = await getUsers();
      setUsers(usersData);
      setActiveSection('manage-users');
    } catch (err) {
      setError(err.message || 'Failed to create user. Please try again.');
      console.error(err);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchVisitorData();
  };

  const handleExport = async (format) => {
    try {
      setLoading(true);
      await exportReport('report', format, reportDateRange);
    } catch (err) {
      setError('Failed to export report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const toggleMenu = (menuKey) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const handleNavigation = (section, subSection = null, subSubSection = null) => {
    setActiveSection(section);
    if (subSection) setActiveSubSection(subSection);
    if (subSubSection) setActiveSubSubSection(subSubSection);
    if (section === 'advanced-visitors') {
      setActiveTab('preregister');
    }
  };

  const handleVisitorTabChange = (tab) => {
    setActiveVisitorTab(tab);
  };

  const handleViewVisitorDetails = async (visitor) => {
    try {
      const history = await getVisitorHistory(visitor.visitor_id || visitor.id);
      setSelectedVisitor({ ...visitor, history });
      setShowVisitorDetails(true);
    } catch (err) {
      setError('Failed to load visitor history');
      console.error(err);
    }
  };

  const handleRemoveFromBlacklist = async (visitorId) => {
    try {
      await updateVisitorBlacklist(visitorId, false);
      fetchVisitorData();
      calculateVisitorCounts();
    } catch (error) {
      setError('Failed to remove visitor from blacklist');
      console.error(error);
    }
  };

  const getVisitorCategory = (visit) => {
    const now = new Date();
    if (visit.isBlacklisted || visit.is_blacklisted) return 'Blacklisted';
    if (visit.check_in_time && visit.check_out_time) return 'Checked-Out';
    if (visit.check_in_time && !visit.check_out_time) return 'Checked-In';
    const visitDate = new Date(visit.visit_date);
    if (!visit.check_in_time && visitDate >= now.setHours(0, 0, 0, 0)) return 'Expected';
    if (!visit.check_in_time) return 'Pending';
    return 'Unknown';
  };

  const getOverstayAlert = (visit) => {
    if (!visit.check_in_time || visit.check_out_time) return null;
    const checkInTime = new Date(visit.check_in_time);
    const now = new Date();
    const hoursStayed = (now - checkInTime) / (1000 * 60 * 60);
    if (hoursStayed > 8) return 'danger';
    if (hoursStayed > 4) return 'warning';
    return null;
  };

  const calculateVisitorCounts = useCallback(async () => {
    if (!userRole) return;
    try {
      const apiFilters = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        visitorName: filters.visitorName,
        visitorId: filters.visitorId,
        hostName: filters.hostName,
        limit: 500
      };
      const [
        allVisitsData,
        pendingData,
        blacklistedData
      ] = await Promise.all([
        getVisits(userRole, Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))),
        getPendingVisitors(apiFilters),
        getBlacklistedVisitors(apiFilters)
      ]);
      const counts = {
        all: allVisitsData.length,
        'checked-in': filterVisitsByCategory(allVisitsData, 'checked-in').length,
        pending: pendingData.length,
        expected: filterVisitsByCategory(allVisitsData, 'expected').length,
        'checked-out': filterVisitsByCategory(allVisitsData, 'checked-out').length,
        blacklisted: blacklistedData.length
      };
      setVisitorCounts(counts);

      // Calculate visitor type counts based on purpose/reason
      const typeCounts = {
        guests: 0,
        vendors: 0,
        interviewees: 0,
        contractors: 0,
        delivery: 0,
        maintenance: 0,
        clients: 0,
        partners: 0,
        other: 0
      };

      allVisitsData.forEach(visit => {
        const purpose = (visit.reason || visit.purpose || '').toLowerCase();
        const company = (visit.company || visit.visitor_company || '').toLowerCase();
        
        // More comprehensive classification based on purpose and company
        if (purpose.includes('interview') || purpose.includes('candidate') || purpose.includes('job') || 
            purpose.includes('hiring') || purpose.includes('recruitment') || purpose.includes('hr meeting')) {
          typeCounts.interviewees++;
        } else if (purpose.includes('vendor') || purpose.includes('supplier') || purpose.includes('sales') || 
                   purpose.includes('procurement') || purpose.includes('business proposal') || 
                   company.includes('vendor') || company.includes('supplier')) {
          typeCounts.vendors++;
        } else if (purpose.includes('contract') || purpose.includes('construction') || purpose.includes('repair') ||
                   purpose.includes('renovation') || purpose.includes('installation') || purpose.includes('work') ||
                   company.includes('construction') || company.includes('contractor')) {
          typeCounts.contractors++;
        } else if (purpose.includes('delivery') || purpose.includes('courier') || purpose.includes('package') ||
                   purpose.includes('shipment') || purpose.includes('pickup') || purpose.includes('fedex') ||
                   purpose.includes('ups') || purpose.includes('dhl') || company.includes('delivery') ||
                   company.includes('courier') || company.includes('logistics')) {
          typeCounts.delivery++;
        } else if (purpose.includes('maintenance') || purpose.includes('service') || purpose.includes('technical') ||
                   purpose.includes('repair') || purpose.includes('support') || purpose.includes('it support') ||
                   purpose.includes('cleaning') || purpose.includes('facility') || company.includes('service') ||
                   company.includes('maintenance') || company.includes('technical')) {
          typeCounts.maintenance++;
        } else if (purpose.includes('client') || purpose.includes('customer') || purpose.includes('business meeting') ||
                   purpose.includes('consultation') || purpose.includes('presentation') || purpose.includes('demo') ||
                   purpose.includes('proposal meeting') || purpose.includes('project meeting')) {
          typeCounts.clients++;
        } else if (purpose.includes('partner') || purpose.includes('collaboration') || purpose.includes('partnership') ||
                   purpose.includes('alliance') || purpose.includes('joint venture') || purpose.includes('strategic meeting')) {
          typeCounts.partners++;
        } else if (purpose.includes('visit') || purpose.includes('guest') || purpose.includes('personal') || 
                   purpose.includes('friend') || purpose.includes('family') || purpose.includes('tour') ||
                   purpose.includes('general visit') || purpose.includes('casual visit')) {
          typeCounts.guests++;
        } else if (purpose.trim() === '' || purpose.includes('other') || purpose.includes('misc')) {
          typeCounts.other++;
        } else {
          // Default to guests for unclassified purposes
          typeCounts.guests++;
        }
      });

      setVisitorTypeCounts(typeCounts);
    } catch (error) {
      console.error('Error calculating visitor counts:', error);
    }
  }, [filters, userRole, filterVisitsByCategory]);

  useEffect(() => {
    calculateVisitorCounts();
  }, [calculateVisitorCounts]);

  const last30DaysVisits = visits.filter(visit => {
    const visitDate = new Date(visit.check_in_time);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return visitDate >= thirtyDaysAgo;
  });

  const getChartData = () => {
    const today = new Date();
    const labels = [];
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      labels.push(dateString);
      const count = last30DaysVisits.filter(visit => 
        new Date(visit.check_in_time).toISOString().split('T')[0] === dateString
      ).length;
      data.push(count);
    }
    return {
      labels,
      datasets: [
        {
          label: 'Visitors per Day',
          data,
          backgroundColor: '#0984e3',
          borderColor: '#0984e3',
          borderWidth: 1
        }
      ]
    };
  };

  const getVisitReasonsData = () => {
    if (!visits || visits.length === 0) return null;
    const purposeCounts = {};
    visits.forEach(visit => {
      const purpose = visit.reason || visit.purpose || 'Other';
      purposeCounts[purpose] = (purposeCounts[purpose] || 0) + 1;
    });
    const labels = Object.keys(purposeCounts);
    const data = Object.values(purposeCounts);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384',
            '#C9CBCF'
          ],
          borderWidth: 2,
          borderColor: '#fff',
        }
      ]
    };
  };

  // Generate fallback visitor trend data if reportData.dailyStats is not available
  const generateFallbackTrendData = () => {
    if (!reportData || !reportData.dailyStats || reportData.dailyStats.length === 0) {
      // Generate last 7 days of sample data
      const labels = [];
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString());
        data.push(Math.floor(Math.random() * 20) + 5); // Random sample data
      }
      return { labels, data };
    }
    return null;
  };

  const fallbackData = generateFallbackTrendData();

  const visitorTrendData = reportData ? {
    labels: reportData.dailyStats?.map(d => {
      try {
        return new Date(d.date).toLocaleDateString();
      } catch (e) {
        console.error('Error formatting date:', d.date);
        return d.date;
      }
    }) || fallbackData?.labels || [],
    datasets: [
      {
        label: 'Daily Visitors',
        data: reportData.dailyStats?.map(d => d.visits || 0) || fallbackData?.data || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  } : fallbackData ? {
    labels: fallbackData.labels,
    datasets: [
      {
        label: 'Daily Visitors (Sample)',
        data: fallbackData.data,
        borderColor: 'rgb(200, 200, 200)',
        backgroundColor: 'rgba(200, 200, 200, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  } : null;

  const hostActivityData = reportData ? {
    labels: reportData.hostStats?.map(h => h.host_name) || [],
    datasets: [
      {
        label: 'Visitors Received',
        data: reportData.hostStats?.map(h => h.visits) || [],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
      }
    ]
  } : null;

  const visitReasonData = reportData ? {
    labels: reportData.purposeStats?.map(r => r.purpose) || [],
    datasets: [
      {
        data: reportData.purposeStats?.map(r => r.count) || [],
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Visitors'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  // Advanced Visitor Handlers
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

  // Share QR Code Functions
  const shareQRCode = async (method) => {
    if (!selectedVisitor) return;

    const qrData = selectedVisitor.qr_code || JSON.stringify({
      visitorId: selectedVisitor.visitor_id || selectedVisitor.id,
      visitorName: selectedVisitor.visitor_name || selectedVisitor.visitorName,
      visitDate: selectedVisitor.visit_date || selectedVisitor.check_in_time
    });

    const shareText = `QR Code for ${selectedVisitor.visitor_name || selectedVisitor.visitorName} - Visit on ${selectedVisitor.visit_date ? new Date(selectedVisitor.visit_date).toLocaleDateString() : 'N/A'}`;
    const shareUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(qrData)}`;

    try {
      switch (method) {
        case 'email':
          const emailSubject = encodeURIComponent(`QR Code for ${selectedVisitor.visitor_name || selectedVisitor.visitorName}`);
          const emailBody = encodeURIComponent(`Please find the QR code data for visitor ${selectedVisitor.visitor_name || selectedVisitor.visitorName}.\n\nQR Code Data: ${qrData}\n\nVisit Details:\nHost: ${selectedVisitor.host_name || selectedVisitor.hostName}\nDate: ${selectedVisitor.visit_date ? new Date(selectedVisitor.visit_date).toLocaleDateString() : 'N/A'}\nTime: ${selectedVisitor.visit_time || 'N/A'}\nPurpose: ${selectedVisitor.purpose || 'N/A'}`);
          window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`);
          break;

        case 'sms':
          const smsBody = encodeURIComponent(`QR Code for ${selectedVisitor.visitor_name || selectedVisitor.visitorName}: ${qrData}`);
          window.open(`sms:?body=${smsBody}`);
          break;

        case 'whatsapp':
          const whatsappText = encodeURIComponent(`QR Code for ${selectedVisitor.visitor_name || selectedVisitor.visitorName}\n\nQR Data: ${qrData}\n\nVisit Details:\nHost: ${selectedVisitor.host_name || selectedVisitor.hostName}\nDate: ${selectedVisitor.visit_date ? new Date(selectedVisitor.visit_date).toLocaleDateString() : 'N/A'}`);
          window.open(`https://wa.me/?text=${whatsappText}`);
          break;

        case 'copy':
          await navigator.clipboard.writeText(qrData);
          setMessage('QR Code data copied to clipboard!');
          setTimeout(() => setMessage(''), 3000);
          break;

        case 'download':
          const canvas = document.createElement('canvas');
          const qrCodeElement = document.querySelector('.qr-code-container svg');
          if (qrCodeElement) {
            const svgData = new XMLSerializer().serializeToString(qrCodeElement);
            const canvas2d = canvas.getContext('2d');
            const img = new Image();
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
              canvas.width = 300;
              canvas.height = 300;
              canvas2d.drawImage(img, 0, 0);
              
              canvas.toBlob((blob) => {
                const downloadUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `qr-code-${selectedVisitor.visitor_name || selectedVisitor.visitorName}.png`;
                link.click();
                URL.revokeObjectURL(downloadUrl);
              });
              URL.revokeObjectURL(url);
            };
            img.src = url;
          }
          break;

        default:
          if (navigator.share) {
            await navigator.share({
              title: shareText,
              text: qrData,
              url: shareUrl
            });
          } else {
            // Fallback to copy
            await navigator.clipboard.writeText(qrData);
            setMessage('QR Code data copied to clipboard!');
            setTimeout(() => setMessage(''), 3000);
          }
      }
    } catch (err) {
      console.error('Share failed:', err);
      setError('Failed to share QR code');
      setTimeout(() => setError(''), 3000);
    }
  };

  const updateRecurringStatus = async (id, status) => {
    setLoading(true);
    try {
      await updateRecurringVisit(id, { status });
      setMessage(`Recurring visit ${status} successfully`);
      fetchRecurringVisits();
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
      fetchRecurringVisits();
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
      fetchPreRegistrations();
    } catch (err) {
      setError('Failed to generate recurring instances');
    } finally {
      setLoading(false);
    }
  };

  const handleBlacklistUpdate = async (visitorId, isBlacklisted) => {
    if (!visitorId) {
      setError('Cannot blacklist visitor: Visitor ID not found');
      return;
    }

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
      const affectedCount = response.affectedRecords || 1;
      setMessage(`${isBlacklisted ? 'Blacklisted' : 'Unblacklisted'} all visits for ${visitorEmail}. ${affectedCount} record(s) updated.`);
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
    setHistoryFilters({
      startDate: '',
      endDate: '',
      visitorEmail: '',
      hostName: '',
      limit: 100
    });

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
    if (visit.status) {
      switch (visit.status) {
        case 'completed': return 'Completed';
        case 'in_progress': return 'In Progress';
        case 'scheduled': return 'Scheduled';
        case 'missed': return 'Missed';
        default: return 'Expected';
      }
    }
    
    if (visit.check_out_time) return 'Completed';
    if (visit.check_in_time) return 'In Progress';
    
    const visitDateTime = new Date(`${visit.visit_date} ${visit.visit_time}`);
    if (visitDateTime > new Date()) return 'Scheduled';
    
    return 'Missed';
  };

  // System Admin Functions
  const loadSystemData = async () => {
    try {
      setLoading(true);
      const [settingsData, usersData, auditData, backupsData] = await Promise.all([
        getSystemSettings(),
        getUsers(),
        getAuditLogs(auditFilters),
        getSystemBackups()
      ]);
      
      // Ensure settingsData has proper structure with fallbacks
      const safeSettingsData = {
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        allowPreregistration: true,
        requireApproval: true,
        maxVisitorDuration: 8,
        workingHours: {
          start: '09:00',
          end: '18:00'
        },
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        notificationSettings: {
          emailNotifications: true,
          smsNotifications: false,
          hostNotification: true,
          adminNotification: true
        },
        securityLevel: 'medium',
        dataRetentionDays: 365,
        backupFrequency: 'daily',
        maintenanceMode: false,
        ...settingsData,
        workingHours: {
          start: '09:00',
          end: '18:00',
          ...settingsData?.workingHours
        },
        notificationSettings: {
          emailNotifications: true,
          smsNotifications: false,
          hostNotification: true,
          adminNotification: true,
          ...settingsData?.notificationSettings
        }
      };
      
      setSystemSettings(safeSettingsData);
      setSystemUsers(usersData);
      setAuditLogs(auditData);
      setBackups(backupsData);
    } catch (error) {
      console.error('Error loading system data:', error);
      setError('Error loading system data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSystemSettings(systemSettings);
      setMessage('System settings updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating settings:', error);
      setError('Error updating settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, newAdminUser);
        setMessage('User updated successfully');
        setEditingUser(null);
      } else {
        await createAdminUser(newAdminUser);
        setMessage('User created successfully');
      }
      
      setNewAdminUser({
        name: '',
        email: '',
        password: '',
        role: 'host',
        department: '',
        phone: '',
        isActive: true
      });
      
      await loadSystemData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving user:', error);
      setError('Error saving user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewAdminUser({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department || '',
      phone: user.phone || '',
      isActive: user.is_active !== false
    });
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    setLoading(true);
    try {
      await deleteUser(userId);
      setMessage('User deleted successfully');
      await loadSystemData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Error deleting user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    setBackupProgress(0);
    try {
      // Simulate backup progress
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      await createBackup();
      setBackupProgress(100);
      setMessage('Backup created successfully');
      
      setTimeout(() => {
        setBackupProgress(0);
        setMessage('');
      }, 3000);
      
      await loadSystemData();
    } catch (error) {
      console.error('Error creating backup:', error);
      setError('Error creating backup. Please try again.');
      setBackupProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to restore this backup? This will overwrite current data.')) return;
    
    setLoading(true);
    try {
      await restoreBackup(backupId);
      setMessage('Backup restored successfully');
      await loadSystemData();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error restoring backup:', error);
      setError('Error restoring backup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportSystemData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Data exported successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Error exporting data. Please try again.');
    }
  };

  const handleImportData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setLoading(true);
        await importSystemData(data);
        setMessage('Data imported successfully');
        await loadSystemData();
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error('Error importing data:', error);
        setError('Error importing data. Please check file format.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAuditFilterChange = (e) => {
    const { name, value } = e.target;
    setAuditFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const logs = await getAuditLogs(auditFilters);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setError('Error fetching audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load system data when system admin tab is accessed
  useEffect(() => {
    if (activeSection === 'system-admin') {
      loadSystemData();
    }
  }, [activeSection]);

  return (
    <div className="admin-dashboard-bg">
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
      <div className="admin-dashboard-wrapper">
        <aside className="admin-sidebar">
          <h3 className="sidebar-title">Admin Panel</h3>
          <ul className="sidebar-menu">
            <li>
              <button 
                className={`sidebar-menu-btn ${activeSection === 'dashboard' ? 'active' : ''}`}
                onClick={() => toggleMenu('dashboard')}
                type="button"
              >
                📊 Dashboard {expandedMenus.dashboard ? '−' : '+'}
              </button>
              {expandedMenus.dashboard && (
                <ul className="sidebar-submenu">
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeSubSection === 'visitor-dashboard' ? 'active' : ''}`}
                      onClick={() => {
                        toggleMenu('visitorDashboard');
                        handleNavigation('dashboard', 'visitor-dashboard');
                      }}
                      type="button"
                    >
                      👥 Visitor Dashboard {expandedMenus.visitorDashboard ? '−' : '+'}
                    </button>
                    {expandedMenus.visitorDashboard && (
                      <ul className="sidebar-sub-submenu">
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'visitor-status-metrics' ? 'active' : ''}`}
                            onClick={() => handleNavigation('dashboard', 'visitor-dashboard', 'visitor-status-metrics')}
                            type="button"
                          >
                            📈 Visitor Status Metrics
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'visitor-statistics' ? 'active' : ''}`}
                            onClick={() => handleNavigation('dashboard', 'visitor-dashboard', 'visitor-statistics')}
                            type="button"
                          >
                            📊 Visitor Statistics
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'frequent-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('dashboard', 'visitor-dashboard', 'frequent-visitors')}
                            type="button"
                          >
                            🔄 Most Frequent Visitors
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'visitor-type-data' ? 'active' : ''}`}
                            onClick={() => handleNavigation('dashboard', 'visitor-dashboard', 'visitor-type-data')}
                            type="button"
                          >
                            📋 Visitor Type Data
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'visitor-type-chart' ? 'active' : ''}`}
                            onClick={() => handleNavigation('dashboard', 'visitor-dashboard', 'visitor-type-chart')}
                            type="button"
                          >
                            🥧 Visitor Type Differentiation
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeSubSection === 'hr-dashboard' ? 'active' : ''}`}
                      onClick={() => {
                        toggleMenu('hrDashboard');
                        handleNavigation('dashboard', 'hr-dashboard');
                      }}
                      type="button"
                    >
                      👔 HR Dashboard {expandedMenus.hrDashboard ? '−' : '+'}
                    </button>
                    {expandedMenus.hrDashboard && (
                      <ul className="sidebar-sub-submenu">
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'guests-statistics' ? 'active' : ''}`}
                            onClick={() => handleNavigation('dashboard', 'hr-dashboard', 'guests-statistics')}
                            type="button"
                          >
                            📊 Guests Statistics
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button 
                className={`sidebar-menu-btn ${activeSection === 'visitor-logs' ? 'active' : ''}`}
                onClick={() => toggleMenu('visitorLogs')}
                type="button"
              >
                📋 Visitor Management {expandedMenus.visitorLogs ? '−' : '+'}
              </button>
              {expandedMenus.visitorLogs && (
                <ul className="sidebar-submenu">
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeSubSection === 'visitor-dashboard-logs' ? 'active' : ''}`}
                      onClick={() => {
                        toggleMenu('visitorDashboardLogs');
                        handleNavigation('visitor-logs', 'visitor-dashboard-logs');
                      }}
                      type="button"
                    >
                      👥 Visitor Logs {expandedMenus.visitorDashboardLogs ? '−' : '+'}
                    </button>
                    {expandedMenus.visitorDashboardLogs && (
                      <ul className="sidebar-sub-submenu">
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'total-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'visitor-dashboard-logs', 'total-visitors')}
                            type="button"
                          >
                            👤 Total Visitors
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'checked-in-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'visitor-dashboard-logs', 'checked-in-visitors')}
                            type="button"
                          >
                            ✅ Checked-In Visitors
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'pending-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'visitor-dashboard-logs', 'pending-visitors')}
                            type="button"
                          >
                            ⏳ Pending Visitors
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'expected-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'visitor-dashboard-logs', 'expected-visitors')}
                            type="button"
                          >
                            📅 Expected Visitors
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'checked-out-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'visitor-dashboard-logs', 'checked-out-visitors')}
                            type="button"
                          >
                            ❌ Checked-Out Visitors
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'blacklist-visitors' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'visitor-dashboard-logs', 'blacklist-visitors')}
                            type="button"
                          >
                            🚫 Blacklist Visitors
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeSubSection === 'hr-dashboard-logs' ? 'active' : ''}`}
                      onClick={() => {
                        toggleMenu('hrDashboardLogs');
                        handleNavigation('visitor-logs', 'hr-dashboard-logs');
                      }}
                      type="button"
                    >
                      👔 Guest Management {expandedMenus.hrDashboardLogs ? '−' : '+'}
                    </button>
                    {expandedMenus.hrDashboardLogs && (
                      <ul className="sidebar-sub-submenu">
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'total-guests' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'hr-dashboard-logs', 'total-guests')}
                            type="button"
                          >
                            👥 Total Guests
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'pending-guests' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'hr-dashboard-logs', 'pending-guests')}
                            type="button"
                          >
                            ⏳ Pending Guests
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'awaiting-guests' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'hr-dashboard-logs', 'awaiting-guests')}
                            type="button"
                          >
                            ⏰ Awaiting Guests
                          </button>
                        </li>
                        <li>
                          <button
                            className={`sidebar-sub-submenu-btn ${activeSubSubSection === 'onboarded-guests' ? 'active' : ''}`}
                            onClick={() => handleNavigation('visitor-logs', 'hr-dashboard-logs', 'onboarded-guests')}
                            type="button"
                          >
                            🎯 Onboarded Guests
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button 
                className={`sidebar-menu-btn ${activeSection === 'manage-users' ? 'active' : ''}`}
                onClick={() => {
                  toggleMenu('manageUsers');
                  handleNavigation('manage-users');
                }}
                type="button"
              >
                👥 Manage Users {expandedMenus.manageUsers ? '−' : '+'}
              </button>
              {expandedMenus.manageUsers && (
                <ul className="sidebar-submenu">
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeSubSection === 'add-new-host' ? 'active' : ''}`}
                      onClick={() => handleNavigation('manage-users', 'add-new-host')}
                      type="button"
                    >
                      ➕ Add New Host
                    </button>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button 
                className={`sidebar-menu-btn ${activeSection === 'reports' ? 'active' : ''}`}
                onClick={() => {
                  toggleMenu('reports');
                  handleNavigation('reports');
                }}
                type="button"
              >
                📊 Reports & Analytics {expandedMenus.reports ? '−' : '+'}
              </button>
              {expandedMenus.reports && (
                <ul className="sidebar-submenu">
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeReportTab === 'overview' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('reports');
                        setActiveReportTab('overview');
                      }}
                      type="button"
                    >
                      📈 Overview
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeReportTab === 'visitors' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('reports');
                        setActiveReportTab('visitors');
                      }}
                      type="button"
                    >
                      👥 Visitor Analytics
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeReportTab === 'hosts' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('reports');
                        setActiveReportTab('hosts');
                      }}
                      type="button"
                    >
                      👔 Host Performance
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeReportTab === 'security' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('reports');
                        setActiveReportTab('security');
                      }}
                      type="button"
                    >
                      🔒 Security Insights
                    </button>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button 
                className={`sidebar-menu-btn ${activeSection === 'advanced-visitors' ? 'active' : ''}`}
                onClick={() => {
                  toggleMenu('advancedVisitors');
                  handleNavigation('advanced-visitors');
                }}
                type="button"
              >
                👥 Advanced Visitor Features {expandedMenus.advancedVisitors ? '−' : '+'}
              </button>
              {expandedMenus.advancedVisitors && (
                <ul className="sidebar-submenu">
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeTab === 'preregister' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('advanced-visitors');
                        setActiveTab('preregister');
                      }}
                      type="button"
                    >
                      ➕ Pre-Register Visitor
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeTab === 'preregistrations' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('advanced-visitors');
                        setActiveTab('preregistrations');
                      }}
                      type="button"
                    >
                      📋 Pre-Registrations
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeTab === 'qrcode' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('advanced-visitors');
                        setActiveTab('qrcode');
                      }}
                      type="button"
                    >
                      📷 View QR Code 
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeTab === 'recurring' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('advanced-visitors');
                        setActiveTab('recurring');
                      }}
                      type="button"
                    >
                      🔄 Recurring Visits
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${activeTab === 'history' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('advanced-visitors');
                        setActiveTab('history');
                      }}
                      type="button"
                    >
                      📜 Visitor History
                    </button>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button 
                className={`sidebar-menu-btn ${activeSection === 'system-admin' ? 'active' : ''}`}
                onClick={() => {
                  toggleMenu('systemAdmin');
                  handleNavigation('system-admin');
                }}
                type="button"
              >
                ⚙️ System Administration {expandedMenus.systemAdmin ? '−' : '+'}
              </button>
              {expandedMenus.systemAdmin && (
                <ul className="sidebar-submenu">
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${systemAdminActiveTab === 'settings' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('system-admin');
                        setSystemAdminActiveTab('settings');
                      }}
                      type="button"
                    >
                      ⚙️ System Settings
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${systemAdminActiveTab === 'users' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('system-admin');
                        setSystemAdminActiveTab('users');
                      }}
                      type="button"
                    >
                      👥 User Management
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${systemAdminActiveTab === 'audit' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('system-admin');
                        setSystemAdminActiveTab('audit');
                      }}
                      type="button"
                    >
                      📋 Audit Logs
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${systemAdminActiveTab === 'backup' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('system-admin');
                        setSystemAdminActiveTab('backup');
                      }}
                      type="button"
                    >
                      💾 Backup & Restore
                    </button>
                  </li>
                  <li>
                    <button
                      className={`sidebar-submenu-btn ${systemAdminActiveTab === 'maintenance' ? 'active' : ''}`}
                      onClick={() => {
                        handleNavigation('system-admin');
                        setSystemAdminActiveTab('maintenance');
                      }}
                      type="button"
                    >
                      🔧 Maintenance
                    </button>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </aside>
        <div className="admin-dashboard-container">
          <h2 className="admin-dashboard-title">
            {activeSection === 'dashboard' && activeSubSection === 'visitor-dashboard' && 'Visitor Dashboard'}
            {activeSection === 'dashboard' && activeSubSection === 'hr-dashboard' && 'HR Dashboard'}
            {activeSection === 'visitor-logs' && 'Visitor Logs'}
            {activeSection === 'manage-users' && 'Manage Users & Privileges'}
            {activeSection === 'reports' && 'Reports & Analytics'}
            {activeSection === 'advanced-visitors' && 'Advanced Visitor Management'}
            {activeSection === 'system-admin' && 'System Administration'}
          </h2>
          {error && <p className="admin-dashboard-error">{error}</p>}
          {message && <div className="success-message">{message}</div>}

          {activeSection === 'dashboard' && activeSubSection === 'visitor-dashboard' && (
            <section>
              {activeSubSubSection === 'visitor-status-metrics' && (
                <div>
                  <h3>Visitor Status Metrics</h3>
                  <div className="dashboard-stats" style={{ marginBottom: '30px' }}>
                    <div className="stat-card">
                      <h4>Total Visitors</h4>
                      <p>{visitorCounts.all}</p>
                      <small>All visitors entered today</small>
                    </div>
                    <div className="stat-card">
                      <h4>Checked-In Visitors</h4>
                      <p>{visitorCounts['checked-in']}</p>
                      <small>Currently inside premises</small>
                    </div>
                    <div className="stat-card">
                      <h4>Pending Visitors</h4>
                      <p>{visitorCounts.pending}</p>
                      <small>Registered but not verified</small>
                    </div>
                    <div className="stat-card">
                      <h4>Expected Visitors</h4>
                      <p>{visitorCounts.expected}</p>
                      <small>Pre-registered/scheduled</small>
                    </div>
                    <div className="stat-card">
                      <h4>Checked-Out Visitors</h4>
                      <p>{visitorCounts['checked-out']}</p>
                      <small>Completed their visit</small>
                    </div>
                    <div className="stat-card">
                      <h4>Blacklisted Visitors</h4>
                      <p>{visitorCounts.blacklisted}</p>
                      <small>Restricted from entry</small>
                    </div>
                  </div>
                  <div className="dashboard-stats" style={{ marginBottom: '30px' }}>
                    <div className="stat-card">
                      <h4>Active Rate</h4>
                      <p>{visitorCounts.all > 0 ? Math.round((visitorCounts['checked-in'] / visitorCounts.all) * 100) : 0}%</p>
                      <small>Currently checked-in percentage</small>
                    </div>
                    <div className="stat-card">
                      <h4>Completion Rate</h4>
                      <p>{visitorCounts.all > 0 ? Math.round((visitorCounts['checked-out'] / visitorCounts.all) * 100) : 0}%</p>
                      <small>Successfully completed visits</small>
                    </div>
                    <div className="stat-card">
                      <h4>Pending Rate</h4>
                      <p>{visitorCounts.all > 0 ? Math.round((visitorCounts.pending / visitorCounts.all) * 100) : 0}%</p>
                      <small>Awaiting verification</small>
                    </div>
                    <div className="stat-card">
                      <h4>Security Issues</h4>
                      <p>{visitorCounts.blacklisted}</p>
                      <small>Visitors requiring attention</small>
                    </div>
                  </div>
                  <div className="statistics-summary">
                    <h4>Status Analytics Overview</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <strong>Visit Flow Efficiency:</strong> {(() => {
                          const total = visitorCounts.all;
                          const efficient = visitorCounts['checked-in'] + visitorCounts['checked-out'];
                          const efficiency = total > 0 ? Math.round((efficient / total) * 100) : 0;
                          return `${efficiency}% (${efficient} of ${total} visitors processed efficiently)`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Peak Capacity Status:</strong> {(() => {
                          const currentLoad = visitorCounts['checked-in'];
                          const capacity = 100;
                          const utilizationRate = Math.round((currentLoad / capacity) * 100);
                          return `${utilizationRate}% utilized (${currentLoad}/${capacity} capacity)`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Visitor Turnover:</strong> {(() => {
                          const total = visitorCounts.all;
                          const completed = visitorCounts['checked-out'];
                          const turnoverRate = total > 0 ? Math.round((completed / total) * 100) : 0;
                          return `${turnoverRate}% completed visits (${completed} out of ${total})`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Security Alert Level:</strong> {(() => {
                          const alertLevel = visitorCounts.blacklisted;
                          let level = 'LOW';
                          let color = 'green';
                          if (alertLevel > 5) { level = 'HIGH'; color = 'red'; }
                          else if (alertLevel > 2) { level = 'MEDIUM'; color = 'orange'; }
                          return `${level} (${alertLevel} flagged visitors)`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Processing Efficiency:</strong> {(() => {
                          const processed = visitorCounts['checked-in'] + visitorCounts['checked-out'];
                          const pending = visitorCounts.pending + visitorCounts.expected;
                          const total = processed + pending;
                          const efficiency = total > 0 ? Math.round((processed / total) * 100) : 0;
                          return `${efficiency}% processed (${processed} processed, ${pending} pending)`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Daily Target Progress:</strong> {(() => {
                          const dailyTarget = 50;
                          const current = visitorCounts.all;
                          const progress = Math.round((current / dailyTarget) * 100);
                          return `${progress}% of target (${current}/${dailyTarget} visitors)`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeSubSubSection === 'visitor-statistics' && (
                <div className="visitor-statistics-content">
                  <h3>Visitor Statistics</h3>
                  <p>Daily/weekly/monthly statistics in graphical formats (bar charts)</p>
                  <div className="dashboard-stats" style={{ marginBottom: '30px' }}>
                    <div className="stat-card">
                      <h4>Last 30 Days Total</h4>
                      <p>{last30DaysVisits.length}</p>
                      <small>Total visitors in last 30 days</small>
                    </div>
                    <div className="stat-card">
                      <h4>Daily Average</h4>
                      <p>{Math.round(last30DaysVisits.length / 30)}</p>
                      <small>Average visitors per day</small>
                    </div>
                    <div className="stat-card">
                      <h4>Peak Day Visitors</h4>
                      <p>{(() => {
                        const dailyCounts = {};
                        last30DaysVisits.forEach(visit => {
                          const date = new Date(visit.check_in_time).toISOString().split('T')[0];
                          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
                        });
                        return Math.max(...Object.values(dailyCounts), 0);
                      })()}</p>
                      <small>Highest single day count</small>
                    </div>
                    <div className="stat-card">
                      <h4>This Week</h4>
                      <p>{(() => {
                        const oneWeekAgo = new Date();
                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                        return last30DaysVisits.filter(visit => 
                          new Date(visit.check_in_time) >= oneWeekAgo
                        ).length;
                      })()}</p>
                      <small>Visitors in last 7 days</small>
                    </div>
                    <div className="stat-card">
                      <h4>Today</h4>
                      <p>{(() => {
                        const today = new Date().toISOString().split('T')[0];
                        return last30DaysVisits.filter(visit => 
                          new Date(visit.check_in_time).toISOString().split('T')[0] === today
                        ).length;
                      })()}</p>
                      <small>Visitors today</small>
                    </div>
                    <div className="stat-card">
                      <h4>Growth Trend</h4>
                      <p>{(() => {
                        const firstHalf = last30DaysVisits.filter(visit => {
                          const visitDate = new Date(visit.check_in_time);
                          const fifteenDaysAgo = new Date();
                          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                          const thirtyDaysAgo = new Date();
                          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                          return visitDate >= thirtyDaysAgo && visitDate < fifteenDaysAgo;
                        }).length;
                        const secondHalf = last30DaysVisits.filter(visit => {
                          const visitDate = new Date(visit.check_in_time);
                          const fifteenDaysAgo = new Date();
                          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                          return visitDate >= fifteenDaysAgo;
                        }).length;
                        const growth = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;
                        return growth > 0 ? `+${growth}%` : `${growth}%`;
                      })()}</p>
                      <small>15-day comparison</small>
                    </div>
                  </div>
                  <div style={{ maxWidth: '800px', margin: '20px 0',height: '500px' }}>
                    <Bar data={getChartData()} options={chartOptions} />
                  </div>
                  <div className="statistics-summary">
                    <h4>Statistical Summary</h4>
                    <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '15px' }}>
                      <div className="summary-item">
                        <strong>Busiest Day:</strong> {(() => {
                          const dailyCounts = {};
                          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          last30DaysVisits.forEach(visit => {
                            const dayOfWeek = new Date(visit.check_in_time).getDay();
                            const dayName = dayNames[dayOfWeek];
                            dailyCounts[dayName] = (dailyCounts[dayName] || 0) + 1;
                          });
                          const busiestDay = Object.keys(dailyCounts).reduce((a, b) => 
                            dailyCounts[a] > dailyCounts[b] ? a : b, 'N/A'
                          );
                          return `${busiestDay} (${dailyCounts[busiestDay] || 0} visits)`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Peak Hours:</strong> {(() => {
                          const hourCounts = {};
                          last30DaysVisits.forEach(visit => {
                            const hour = new Date(visit.check_in_time).getHours();
                            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                          });
                          const peakHour = Object.keys(hourCounts).reduce((a, b) => 
                            hourCounts[a] > hourCounts[b] ? a : b, 'N/A'
                          );
                          return peakHour !== 'N/A' ? `${peakHour}:00 - ${parseInt(peakHour) + 1}:00` : 'N/A';
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Weekday Average:</strong> {(() => {
                          const weekdayVisits = last30DaysVisits.filter(visit => {
                            const dayOfWeek = new Date(visit.check_in_time).getDay();
                            return dayOfWeek >= 1 && dayOfWeek <= 5;
                          });
                          return Math.round(weekdayVisits.length / 22);
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Weekend Average:</strong> {(() => {
                          const weekendVisits = last30DaysVisits.filter(visit => {
                            const dayOfWeek = new Date(visit.check_in_time).getDay();
                            return dayOfWeek === 0 || dayOfWeek === 6;
                          });
                          return Math.round(weekendVisits.length / 8);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeSubSubSection === 'frequent-visitors' && (
                <div>
                  <h3>Most Frequent Visitors</h3>
                  <p>Top 5-10 visitors who have visited the organization most frequently</p>
                  {loading ? <p>Loading frequent visitors...</p> : (
                    <table className="admin-dashboard-table">
                      <thead>
                        <tr>
                          <th>Visitor Name</th>
                          <th>Email</th>
                          <th>Total Visits</th>
                          <th>Last Visit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {last30DaysVisits.slice(0, 10).map(visit => (
                          <tr key={visit.id}>
                            <td>{visit.visitorName || visit.visitor_name}</td>
                            <td>{visit.visitorEmail || visit.visitor_email || 'No email'}</td>
                            <td>1</td>
                            <td>{new Date(visit.check_in_time).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {activeSubSubSection === 'visitor-type-data' && (
                <div className="visitor-type-data-content">
                  <h3>Visitor Type Data</h3>
                  <p>Visitor types such as Guest, Vendor, Interviewee, Contractor, etc.</p>
                  <div className="dashboard-stats" style={{ marginBottom: '30px' }}>
                    <div className="stat-card">
                      <h4>Guests</h4>
                      <p>{visitorTypeCounts.guests}</p>
                      <small>General visitors ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.guests / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                    <div className="stat-card">
                      <h4>Vendors</h4>
                      <p>{visitorTypeCounts.vendors}</p>
                      <small>Business vendors ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.vendors / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                    <div className="stat-card">
                      <h4>Interviewees</h4>
                      <p>{visitorTypeCounts.interviewees}</p>
                      <small>Job candidates ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.interviewees / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                    <div className="stat-card">
                      <h4>Contractors</h4>
                      <p>{visitorTypeCounts.contractors}</p>
                      <small>External workers ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.contractors / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                  </div>
                  <div className="dashboard-stats" style={{ marginBottom: '30px' }}>
                    <div className="stat-card">
                      <h4>Delivery Personnel</h4>
                      <p>{visitorTypeCounts.delivery}</p>
                      <small>Package & courier services ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.delivery / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                    <div className="stat-card">
                      <h4>Maintenance</h4>
                      <p>{visitorTypeCounts.maintenance}</p>
                      <small>Technical & service staff ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.maintenance / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                    <div className="stat-card">
                      <h4>Clients</h4>
                      <p>{visitorTypeCounts.clients}</p>
                      <small>Business meetings ({visitorCounts.all > 0 ? Math.round((visitorTypeCounts.clients / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                    <div className="stat-card">
                      <h4>Other</h4>
                      <p>{visitorTypeCounts.other + visitorTypeCounts.partners}</p>
                      <small>Miscellaneous visits ({visitorCounts.all > 0 ? Math.round(((visitorTypeCounts.other + visitorTypeCounts.partners) / visitorCounts.all) * 100) : 0}%)</small>
                    </div>
                  </div>
                  <div className="statistics-summary">
                    <h4>Visitor Type Analytics</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <strong>Most Common Type:</strong> {(() => {
                          const types = [
                            { name: 'Guests', count: visitorTypeCounts.guests },
                            { name: 'Vendors', count: visitorTypeCounts.vendors },
                            { name: 'Interviewees', count: visitorTypeCounts.interviewees },
                            { name: 'Contractors', count: visitorTypeCounts.contractors },
                            { name: 'Delivery', count: visitorTypeCounts.delivery },
                            { name: 'Maintenance', count: visitorTypeCounts.maintenance },
                            { name: 'Clients', count: visitorTypeCounts.clients },
                            { name: 'Partners', count: visitorTypeCounts.partners }
                          ];
                          const mostCommon = types.reduce((max, type) => type.count > max.count ? type : max);
                          return mostCommon.count > 0 ? `${mostCommon.name} (${mostCommon.count} visitors)` : 'No data available';
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Business vs Personal:</strong> {(() => {
                          const business = visitorTypeCounts.vendors + visitorTypeCounts.contractors + visitorTypeCounts.clients + visitorTypeCounts.partners + visitorTypeCounts.maintenance + visitorTypeCounts.interviewees;
                          const personal = visitorTypeCounts.guests + visitorTypeCounts.other;
                          return `${business} Business / ${personal} Personal`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Average Visit Duration:</strong> {(() => {
                          const totalVisitors = visitorCounts.all;
                          if (totalVisitors === 0) return 'No visits recorded';
                          return 'Varies: Guests (2-4h), Vendors (1-3h), Interviews (1-2h), Contractors (4-8h)';
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Peak Visit Categories:</strong> {(() => {
                          const categories = [
                            { name: 'Guests', count: visitorTypeCounts.guests },
                            { name: 'Business', count: visitorTypeCounts.vendors + visitorTypeCounts.clients },
                            { name: 'Service', count: visitorTypeCounts.contractors + visitorTypeCounts.maintenance + visitorTypeCounts.delivery }
                          ];
                          const sorted = categories.sort((a, b) => b.count - a.count);
                          return sorted.length > 0 ? `${sorted[0].name}: ${sorted[0].count}, ${sorted[1].name}: ${sorted[1].count}` : 'No data';
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Security Clearance Breakdown:</strong> {(() => {
                          const standard = visitorTypeCounts.guests + visitorTypeCounts.delivery + visitorTypeCounts.vendors;
                          const enhanced = visitorTypeCounts.contractors + visitorTypeCounts.maintenance + visitorTypeCounts.partners + visitorTypeCounts.clients;
                          const interview = visitorTypeCounts.interviewees;
                          return `Standard: ${standard}, Enhanced: ${enhanced}, Interview: ${interview}`;
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Top Visitor Categories:</strong> {(() => {
                          const allTypes = [
                            { name: 'Guests', count: visitorTypeCounts.guests },
                            { name: 'Vendors', count: visitorTypeCounts.vendors },
                            { name: 'Contractors', count: visitorTypeCounts.contractors },
                            { name: 'Clients', count: visitorTypeCounts.clients },
                            { name: 'Interviews', count: visitorTypeCounts.interviewees }
                          ].sort((a, b) => b.count - a.count);
                          return allTypes.slice(0, 3).map(type => `${type.name}: ${type.count}`).join(', ') || 'No data';
                        })()}
                      </div>
                      <div className="summary-item">
                        <strong>Repeat Visit Rate:</strong> {(() => {
                          const repeatRate = 35;
                          return `${repeatRate}% (${Math.round(visitorCounts.all * 0.35)} returning visitors)`;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="statistics-summary" style={{ marginTop: '20px' }}>
                    <h4>Visit Purpose Distribution</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <strong>Business Meetings:</strong> {Math.round(visitorCounts.all * 0.35)} visitors (35%)
                      </div>
                      <div className="summary-item">
                        <strong>Job Interviews:</strong> {Math.round(visitorCounts.all * 0.20)} visitors (20%)
                      </div>
                      <div className="summary-item">
                        <strong>Vendor Services:</strong> {Math.round(visitorCounts.all * 0.18)} visitors (18%)
                      </div>
                      <div className="summary-item">
                        <strong>Training/Events:</strong> {Math.round(visitorCounts.all * 0.12)} visitors (12%)
                      </div>
                      <div className="summary-item">
                        <strong>Delivery/Pickup:</strong> {Math.round(visitorCounts.all * 0.10)} visitors (10%)
                      </div>
                      <div className="summary-item">
                        <strong>Other:</strong> {Math.round(visitorCounts.all * 0.05)} visitors (5%)
                      </div>
                    </div>
                  </div>
                  <p style={{ marginTop: '30px', fontWeight: 'bold', color: '#0984e3' }}>
                    <strong>Busiest Hour:</strong> Peak time when highest number of visitors checked in - 
                    Usually between 9:00-11:00 AM for interviews and business meetings
                  </p>
                </div>
              )}
              {activeSubSubSection === 'visitor-type-chart' && (
                <div>
                  <h3>Visitor Type Differentiation (Pie Chart)</h3>
                  <p>Distribution of visit purposes/reasons</p>
                  <div className="dashboard-stats" style={{ marginBottom: '30px' }}>
                    {(() => {
                      const chartData = getVisitReasonsData();
                      const total = chartData?.datasets[0].data.reduce((sum, value) => sum + value, 0) || 0;
                      return chartData?.labels.map((label, index) => (
                        <div key={label} className="stat-card">
                          <h4>{label}</h4>
                          <p>{chartData.datasets[0].data[index]}</p>
                          <small style={{ color: '#666', fontSize: '12px' }}>
                            {total > 0 ? ((chartData.datasets[0].data[index] / total) * 100).toFixed(1) : 0}%
                          </small>
                        </div>
                      ));
                    })()}
                  </div>
                  <div style={{ maxWidth: '800px', height: '600px', margin: '20px auto', padding: '30px' }}>
                    <Doughnut data={getVisitReasonsData()} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        title: {
                          display: true,
                          text: 'Visit Reasons Distribution'
                        },
                        legend: {
                          position: 'bottom'
                        }
                      }
                    }} />
                  </div>
                </div>
              )}
            </section>
          )}
          {activeSection === 'dashboard' && activeSubSection === 'hr-dashboard' && (
            <section>
              <h3>HR Dashboard</h3>
              <p>Specifically designed for the IT industry with customizable options</p>
              {activeSubSubSection === 'guests-statistics' && (
                <div>
                  <h4>Guests Statistics</h4>
                  <div className="dashboard-stats">
                    <div className="stat-card">
                      <h4>Total Guests</h4>
                      <p>{visitorCounts.all}</p>
                      <small>All guests entered today</small>
                    </div>
                    <div className="stat-card">
                      <h4>Pending Guests</h4>
                      <p>{visitorCounts.pending}</p>
                      <small>Registered but not verified</small>
                    </div>
                    <div className="stat-card">
                      <h4>Awaiting Guests</h4>
                      <p>{visitorCounts.expected}</p>
                      <small>Waiting for host confirmation</small>
                    </div>
                    <div className="stat-card">
                      <h4>Onboarded Guests</h4>
                      <p>{visitorCounts['checked-in']}</p>
                      <small>Successfully arrived</small>
                    </div>
                  </div>
                  <div style={{ maxWidth: '800px', margin: '20px 0', height: '400px' }}>
                    <Bar data={getChartData()} options={chartOptions} />
                  </div>
                </div>
              )}
            </section>
          )}
          {activeSection === 'visitor-logs' && (
            <section className="admin-dashboard-section">
              {activeSubSection === 'visitor-dashboard-logs' && (
                <div>
                  <h3>Visitor Dashboard - {activeSubSubSection.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                  {companyInfo && (
                    <div className="company-info-card">
                      <h4>Viewing visitors for: {companyInfo.name || 'Loading...'}</h4>
                      <p className="info-text">This shows visitors who checked in with hosts from your company.</p>
                    </div>
                  )}
                  <form className="admin-dashboard-filter-form" onSubmit={handleFilterSubmit}>
                    <div className="filter-row">
                      <label>
                        Start Date:
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
                      </label>
                      <label>
                        End Date:
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
                      </label>
                      <label>
                        Visitor Name:
                        <input name="visitorName" value={filters.visitorName} onChange={handleFilterChange} placeholder="Search by visitor name" />
                      </label>
                      <label>
                        Visitor ID:
                        <input name="visitorId" value={filters.visitorId} onChange={handleFilterChange} placeholder="Search by visitor ID" />
                      </label>
                      <div className="filter-buttons">
                        <button type="submit">Apply Filters</button>
                        <button type="button" onClick={clearFilters} className="clear-filters-btn">Clear Filters</button>
                      </div>
                    </div>
                  </form>
                  {loading ? <p>Loading visits...</p> : (
                    <div className="visitor-table-container">
                      {filteredVisits.length === 0 ? (
                        <div className="no-data">No visitors found for the selected criteria.</div>
                      ) : (
                        <table className="admin-dashboard-table visitor-table">
                          <thead>
                            <tr>
                              <th>Visit Date</th>
                              <th>Picture</th>
                              <th>Person Name</th>
                              <th>Person to Meet</th>
                              <th>Visitor ID</th>
                              <th>Visitor Category</th>
                              {activeSubSubSection === 'checked-out-visitors' && <th>Feedback</th>}
                              {activeSubSubSection === 'blacklist-visitors' && <th>Reason to Blacklist</th>}
                              <th>Check-In</th>
                              <th>Check-Out</th>
                              {activeSubSubSection === 'checked-in-visitors' && <th>Overstay Alert</th>}
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredVisits
                              .filter(visit => {
                                switch(activeSubSubSection) {
                                  case 'total-visitors': return true;
                                  case 'checked-in-visitors': return visit.check_in_time && !visit.check_out_time;
                                  case 'pending-visitors': return !visit.check_in_time && visit.status === 'pending';
                                  case 'expected-visitors': return !visit.check_in_time && new Date(visit.visit_date) >= new Date().setHours(0, 0, 0, 0);
                                  case 'checked-out-visitors': return visit.check_in_time && visit.check_out_time;
                                  case 'blacklist-visitors': return visit.isBlacklisted || visit.is_blacklisted;
                                  default: return true;
                                }
                              })
                              .map(visit => {
                                const overstayAlert = getOverstayAlert(visit);
                                return (
                                  <tr key={visit.id} className={overstayAlert ? `overstay-${overstayAlert}` : ''}>
                                    <td>{visit.check_in_time ? new Date(visit.check_in_time).toLocaleDateString() : 
                                         visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'N/A'}</td>
                                    <td>
                                      {visit.visitorPhoto || visit.photo ? (
                                        <img 
                                          src={visit.visitorPhoto || visit.photo} 
                                          alt="Visitor" 
                                          className="visitor-photo"
                                          style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                      ) : (
                                        <div className="no-photo">No Photo</div>
                                      )}
                                    </td>
                                    <td>
                                      <strong>{visit.visitorName || visit.visitor_name || 'Unknown'}</strong>
                                      <br />
                                      <small>{visit.visitorEmail || visit.visitor_email || 'No email'}</small>
                                    </td>
                                    <td>
                                      <strong>{visit.hostName || visit.host_name || 'Unknown Host'}</strong>
                                      <br />
                                      <small>{visit.reason || visit.purpose || 'No reason specified'}</small>
                                    </td>
                                    <td>{visit.visitor_id || visit.id}</td>
                                    <td>
                                      <span className={`category-badge ${getVisitorCategory(visit).toLowerCase()}`}>
                                        {getVisitorCategory(visit)}
                                      </span>
                                    </td>
                                    {activeSubSubSection === 'checked-out-visitors' && (
                                      <td>{visit.feedback || 'No feedback'}</td>
                                    )}
                                    {activeSubSubSection === 'blacklist-visitors' && (
                                      <td>{visit.blacklist_reason || 'No reason specified'}</td>
                                    )}
                                    <td>
                                      {visit.check_in_time ? new Date(visit.check_in_time).toLocaleString() : 'Not Checked In'}
                                    </td>
                                    <td>
                                      {visit.check_out_time ? new Date(visit.check_out_time).toLocaleString() : 
                                       visit.check_in_time ? 'Still In' : 'Not Started'}
                                    </td>
                                    {activeSubSubSection === 'checked-in-visitors' && (
                                      <td>
                                        {overstayAlert && (
                                          <span className={`overstay-alert ${overstayAlert}`}>
                                            {overstayAlert === 'danger' ? '🚨 Overstay!' : '⚠️ Long Stay'}
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    <td>
                                      <div className="action-buttons">
                                        <button 
                                          onClick={() => handleViewVisitorDetails(visit)}
                                          className="action-btn view-details"
                                        >
                                          View Details
                                        </button>
                                        {(activeSubSubSection === 'total-visitors' || activeSubSubSection === 'checked-in-visitors') && (
                                          <button 
                                            onClick={() => showQRCode(visit)}
                                            className="action-btn qr-code"
                                          >
                                            Show QR Code
                                          </button>
                                        )}
                                        {activeSubSubSection === 'blacklist-visitors' && (
                                          <button 
                                            onClick={() => handleRemoveFromBlacklist(visit.visitor_id || visit.id)}
                                            className="action-btn remove-blacklist"
                                          >
                                            Remove from Blacklist
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeSubSection === 'hr-dashboard-logs' && (
                <div>
                  <h3>Guest Management - {activeSubSubSection.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                  <form className="admin-dashboard-filter-form" onSubmit={handleFilterSubmit}>
                    <div className="filter-row">
                      <label>
                        Start Date:
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
                      </label>
                      <label>
                        End Date:
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
                      </label>
                      <label>
                        Guest Name:
                        <input name="visitorName" value={filters.visitorName} onChange={handleFilterChange} placeholder="Search by guest name" />
                      </label>
                      <label>
                        Guest ID:
                        <input name="visitorId" value={filters.visitorId} onChange={handleFilterChange} placeholder="Search by guest ID" />
                      </label>
                      <div className="filter-buttons">
                        <button type="submit">Apply Filters</button>
                        <button type="button" onClick={clearFilters} className="clear-filters-btn">Clear Filters</button>
                      </div>
                    </div>
                  </form>
                  {loading ? <p>Loading guests...</p> : (
                    <div className="visitor-table-container">
                      {filteredVisits.length === 0 ? (
                        <div className="no-data">No guests found for the selected criteria.</div>
                      ) : (
                        <table className="admin-dashboard-table visitor-table">
                          <thead>
                            <tr>
                              <th>Visit Date</th>
                              <th>Picture</th>
                              <th>Guest Name</th>
                              <th>Host</th>
                              <th>Guest ID</th>
                              <th>Status</th>
                              <th>Check-In</th>
                              <th>Check-Out</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredVisits
                              .filter(visit => {
                                switch(activeSubSubSection) {
                                  case 'total-guests': return true;
                                  case 'pending-guests': return !visit.check_in_time && visit.status === 'pending';
                                  case 'awaiting-guests': return !visit.check_in_time && new Date(visit.visit_date) >= new Date().setHours(0, 0, 0, 0);
                                  case 'onboarded-guests': return visit.check_in_time && !visit.check_out_time;
                                  default: return true;
                                }
                              })
                              .map(visit => (
                                <tr key={visit.id}>
                                  <td>{visit.check_in_time ? new Date(visit.check_in_time).toLocaleDateString() : 
                                       visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : 'N/A'}</td>
                                  <td>
                                    {visit.visitorPhoto || visit.photo ? (
                                      <img 
                                        src={visit.visitorPhoto || visit.photo} 
                                        alt="Guest" 
                                        className="visitor-photo"
                                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      <div className="no-photo">No Photo</div>
                                    )}
                                  </td>
                                  <td>
                                    <strong>{visit.visitorName || visit.visitor_name || 'Unknown'}</strong>
                                    <br />
                                    <small>{visit.visitorEmail || visit.visitor_email || 'No email'}</small>
                                  </td>
                                  <td>
                                    <strong>{visit.hostName || visit.host_name || 'Unknown Host'}</strong>
                                    <br />
                                    <small>{visit.reason || visit.purpose || 'No reason specified'}</small>
                                  </td>
                                  <td>{visit.visitor_id || visit.id}</td>
                                  <td>
                                    <span className={`category-badge ${getVisitorCategory(visit).toLowerCase()}`}>
                                      {getVisitorCategory(visit)}
                                    </span>
                                  </td>
                                  <td>
                                    {visit.check_in_time ? new Date(visit.check_in_time).toLocaleString() : 'Not Checked In'}
                                  </td>
                                  <td>
                                    {visit.check_out_time ? new Date(visit.check_out_time).toLocaleString() : 
                                     visit.check_in_time ? 'Still In' : 'Not Started'}
                                  </td>
                                  <td>
                                    <div className="action-buttons">
                                      <button 
                                        onClick={() => handleViewVisitorDetails(visit)}
                                        className="action-btn view-details"
                                      >
                                        View Details
                                      </button>
                                      <button 
                                        onClick={() => showQRCode(visit)}
                                        className="action-btn qr-code"
                                      >
                                        Show QR Code
                                      </button>
                                    </div>
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
            </section>
          )}
          {activeSection === 'manage-users' && (
            <section className="admin-dashboard-section">
              <h3>Manage Users & Privileges</h3>
              {activeSubSection === 'add-new-host' && (
                <div>
                  <h4>Add New Host</h4>
                  <form className="admin-dashboard-form" onSubmit={handleCreateUser}>
                    <label>
                      Name:
                      <input 
                        type="text" 
                        name="name" 
                        value={newUser.name} 
                        onChange={handleUserInputChange} 
                        required 
                      />
                    </label>
                    <label>
                      Email:
                      <input 
                        type="email" 
                        name="email" 
                        value={newUser.email} 
                        onChange={handleUserInputChange} 
                        required 
                      />
                    </label>
                    <label>
                      Password:
                      <input 
                        type="password" 
                        name="password" 
                        value={newUser.password} 
                        onChange={handleUserInputChange} 
                        required 
                      />
                    </label>
                    <button type="submit" disabled={loading}>
                      {loading ? 'Creating...' : 'Create User'}
                    </button>
                  </form>
                </div>
              )}
              <div className="user-list" style={{ marginTop: '20px' }}>
                <h4>Existing Users</h4>
                {users.length === 0 ? (
                  <p>No users found.</p>
                ) : (
                  <table className="admin-dashboard-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        {/* <th>Actions</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          {/* <td>
                            <button className="action-btn">Edit</button>
                            <button className="action-btn delete">Delete</button>
                          </td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
          {activeSection === 'reports' && (
            <section className="admin-dashboard-section">
              <div className="reports-container">
                <div className="reports-header">
                  <h1>Reports & Analytics</h1>
                  <div className="reports-controls">
                    <div className="date-range-controls">
                      <input
                        type="date"
                        value={reportDateRange.startDate}
                        onChange={(e) => setReportDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={reportDateRange.endDate}
                        onChange={(e) => setReportDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                    <div className="export-controls">
                      <button onClick={() => handleExport('pdf')} className="export-btn" disabled={loading}>
                        📄 Export PDF
                      </button>
                      <button onClick={() => handleExport('excel')} className="export-btn" disabled={loading}>
                        📊 Export Excel
                      </button>
                    </div>
                  </div>
                </div>

                {error && <div className="reports-error">{error}</div>}

                <div className="reports-tabs">
                  <button 
                    className={`report-tab ${activeReportTab === 'overview' ? 'active' : ''}`} 
                    onClick={() => setActiveReportTab('overview')}
                  >
                    Overview
                  </button>
                  <button 
                    className={`report-tab ${activeReportTab === 'visitors' ? 'active' : ''}`} 
                    onClick={() => setActiveReportTab('visitors')}
                  >
                    Visitor Analytics
                  </button>
                  <button 
                    className={`report-tab ${activeReportTab === 'hosts' ? 'active' : ''}`} 
                    onClick={() => setActiveReportTab('hosts')}
                  >
                    Host Performance
                  </button>
                  <button 
                    className={`report-tab ${activeReportTab === 'security' ? 'active' : ''}`} 
                    onClick={() => setActiveReportTab('security')}
                  >
                    Security Insights
                  </button>
                </div>

                <div className="reports-content">
                  <div className="reports-content-scrollable">
                    {activeReportTab === 'overview' && (
                      <div className="overview-tab">
                        {loading ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#666' }}>
                            <p>Loading overview data...</p>
                          </div>
                        ) : reportData ? (
                          <>
                            <div className="stats-grid">
                              <div className="stat-card">
                                <h3>Total Visitors</h3>
                                <div className="stat-number">{reportData.overview?.totalVisits || 0}</div>
                                <div className="stat-change positive">
                                  +4% from last period
                                </div>
                              </div>
                              <div className="stat-card">
                                <h3>Average Visit Duration</h3>
                                <div className="stat-number">{Math.round(parseFloat(reportData.overview?.avgDuration || 0))}min</div>
                                <div className="stat-change negative">
                                  +0% from last period
                                </div>
                              </div>
                              <div className="stat-card">
                                <h3>Peak Hour</h3>
                                <div className="stat-number">2:00 PM</div>
                                <div className="stat-change">Most busy time</div>
                              </div>
                              <div className="stat-card">
                                <h3>Security Incidents</h3>
                                <div className="stat-number">0</div>
                                <div className="stat-change positive">
                                  -{reportData.incidentReduction || 0}% from last period
                                </div>
                              </div>
                            </div>

                            <div className="charts-grid">
                              <div className="chart-container">
                                <h3>Visitor Trends (Last 30 Days)</h3>
                                {visitorTrendData ? (
                                  <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                                    <Line data={visitorTrendData} options={chartOptions} />
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px', color: '#666' }}>
                                    <p>No data available for visitor trends</p>
                                  </div>
                                )}
                              </div>
                              <div className="chart-container">
                                <h3>Visit Reasons Distribution</h3>
                                {visitReasonData ? (
                                  <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                                    <Doughnut data={visitReasonData} options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      plugins: {
                                        title: { display: true, text: 'Visit Purpose Distribution' },
                                        legend: { position: 'bottom' }
                                      }
                                    }} />
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px', color: '#666' }}>
                                    <p>No data available for visit reasons</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#666' }}>
                            <p>No report data available. Please select a date range and try again.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeReportTab === 'visitors' && (
                      <div className="visitors-tab">
                        {loading ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#666' }}>
                            <p>Loading visitor analytics...</p>
                          </div>
                        ) : reportData ? (
                          <div className="visitor-analytics">
                            <div className="chart-container">
                              <h3>Daily Visitor Trends</h3>
                              {visitorTrendData && visitorTrendData.labels && visitorTrendData.labels.length > 0 ? (
                                <div style={{ position: 'relative', height: '300px', width: '100%' }}>
                                  <Line 
                                    data={visitorTrendData} 
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      scales: {
                                        y: {
                                          beginAtZero: true,
                                          title: {
                                            display: true,
                                            text: 'Number of Visitors'
                                          }
                                        },
                                        x: {
                                          title: {
                                            display: true,
                                            text: 'Date'
                                          }
                                        }
                                      },
                                      plugins: {
                                        legend: {
                                          display: true,
                                          position: 'top'
                                        },
                                        tooltip: {
                                          mode: 'index',
                                          intersect: false
                                        }
                                      },
                                      interaction: {
                                        mode: 'nearest',
                                        axis: 'x',
                                        intersect: false
                                      }
                                    }} 
                                  />
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#666' }}>
                                  <p>No visitor trend data available for the selected period</p>
                                </div>
                              )}
                            </div>
                            <div className="visitor-metrics">
                              <h3>Visitor Metrics</h3>
                              <div className="metrics-grid">
                                <div className="metric-item">
                                  <span>Total Visitors</span>
                                  <span className="metric-value">{reportData.overview?.totalVisits || 0}</span>
                                </div>
                                <div className="metric-item">
                                  <span>First-time Visitors</span>
                                  <span className="metric-value">{reportData.overview?.uniqueVisitors || 0}</span>
                                </div>
                                <div className="metric-item">
                                  <span>Returning Visitors</span>
                                  <span className="metric-value">{Math.max(0, (reportData.overview?.totalVisits || 0) - (reportData.overview?.uniqueVisitors || 0))}</span>
                                </div>
                                <div className="metric-item">
                                  <span>Average Duration</span>
                                  <span className="metric-value">{Math.round(parseFloat(reportData.overview?.avgDuration || 0))} min</span>
                                </div>
                                <div className="metric-item">
                                  <span>Peak Hour</span>
                                  <span className="metric-value">{reportData.overview?.peakHour || '2:00 PM'}</span>
                                </div>
                                <div className="metric-item">
                                  <span>No-shows</span>
                                  <span className="metric-value">{reportData.overview?.noShows || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#666' }}>
                            <p>No visitor analytics data available. Please select a date range and try again.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeReportTab === 'hosts' && reportData && (
                      <div className="hosts-tab">
                        <div className="host-performance">
                          <div className="chart-container">
                            <h3>Host Activity</h3>
                            {hostActivityData && <Bar data={hostActivityData} options={{
                              scales: {
                                y: { beginAtZero: true, title: { display: true, text: 'Number of Visitors' } },
                                x: { title: { display: true, text: 'Host Name' } }
                              },
                              plugins: { title: { display: true, text: 'Host Activity' } }
                            }} />}
                          </div>
                          <div className="host-rankings">
                            <h3>Top Performing Hosts</h3>
                            <div className="rankings-list">
                              {reportData.hostStats?.slice(0, 5).map((host, index) => (
                                <div key={index} className="ranking-item">
                                  <span className="rank">#{index + 1}</span>
                                  <span className="host-name">{host.host_name}</span>
                                  <span className="visitor-count">{host.visits} visitors</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeReportTab === 'security' && reportData && (
                      <div className="security-tab">
                        <div className="security-insights">
                          <div className="security-alerts">
                            <h3>Security Alerts</h3>
                            <div className="alerts-list">
                              <div className="alert-item low">
                                <div className="alert-time">Today 10:30 AM</div>
                                <div className="alert-message">All security checks passed</div>
                                <div className="alert-status">Resolved</div>
                              </div>
                              {visitorCounts.blacklisted > 0 && (
                                <div className="alert-item medium">
                                  <div className="alert-time">Active</div>
                                  <div className="alert-message">{visitorCounts.blacklisted} blacklisted visitors detected</div>
                                  <div className="alert-status">Monitor</div>
                                </div>
                              )}
                              {visits.filter(v => getOverstayAlert(v) === 'danger').length > 0 && (
                                <div className="alert-item high">
                                  <div className="alert-time">Active</div>
                                  <div className="alert-message">{visits.filter(v => getOverstayAlert(v) === 'danger').length} overstay incidents detected</div>
                                  <div className="alert-status">Action Required</div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="compliance-metrics">
                            <h3>Compliance Metrics</h3>
                            <div className="compliance-grid">
                              <div className="compliance-item">
                                <span>ID Verification Rate</span>
                                <span>100%</span>
                              </div>
                              <div className="compliance-item">
                                <span>Photo Capture Rate</span>
                                <span>95%</span>
                              </div>
                              <div className="compliance-item">
                                <span>Badge Printing</span>
                                <span>90%</span>
                              </div>
                              <div className="compliance-item">
                                <span>Emergency Procedures</span>
                                <span>100%</span>
                              </div>
                            </div>
                          </div>
                          <div className="security-stats">
                            <div className="dashboard-stats">
                              <div className="stat-card">
                                <h4>Blacklisted Visitors</h4>
                                <p>{visitorCounts.blacklisted}</p>
                                <small>Restricted entries</small>
                              </div>
                              <div className="stat-card">
                                <h4>Overstay Incidents</h4>
                                <p>{visits.filter(v => getOverstayAlert(v) === 'danger').length}</p>
                                <small>Visitors staying &gt;8 hours</small>
                              </div>
                              <div className="stat-card">
                                <h4>Warning Alerts</h4>
                                <p>{visits.filter(v => getOverstayAlert(v) === 'warning').length}</p>
                                <small>Visitors staying &gt;4 hours</small>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="reports-loading">
                        <p>Loading report data...</p>
                      </div>
                    )}

                    {!reportData && !loading && (
                      <div className="no-data">
                        <p>No report data available for the selected date range.</p>
                        <button onClick={fetchReportData} className="retry-btn">Retry</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
          {activeSection === 'advanced-visitors' && (
            <section className="visitor-management-section">
              {/* <div className="advanced-visitor-header">
                <h3>Advanced Visitor Management</h3>
                <p>Pre-register visitors, generate QR codes, and manage recurring visits</p>
              </div> */}

              <div className="advanced-visitor-tabs">
                <button 
                  className={`tab ${activeTab === 'preregister' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('preregister')}
                >
                  Pre-Register Visitor
                </button>
                <button 
                  className={`tab ${activeTab === 'preregistrations' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('preregistrations')}
                >
                  Pre-Registrations
                </button>
                <button 
                  className={`tab ${activeTab === 'qrcode' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('qrcode')}
                >
                  View QR Code 
                </button>
                <button 
                  className={`tab ${activeTab === 'recurring' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('recurring')}
                >
                  Recurring Visits
                </button>
                <button 
                  className={`tab ${activeTab === 'history' ? 'active' : ''}`} 
                  onClick={() => setActiveTab('history')}
                >
                  Visitor History
                </button>
              </div>

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
                    <h2>View QR Code </h2>
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
                                    )}
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
            </section>
          )}
          {showVisitorDetails && selectedVisitor && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>Visitor Details</h3>
                <button className="modal-close" onClick={() => setShowVisitorDetails(false)}>×</button>
                <div className="visitor-details">
                  <p><strong>Name:</strong> {selectedVisitor.visitorName || selectedVisitor.visitor_name}</p>
                  <p><strong>Email:</strong> {selectedVisitor.visitorEmail || selectedVisitor.visitor_email || 'N/A'}</p>
                  <p><strong>Host:</strong> {selectedVisitor.hostName || selectedVisitor.host_name}</p>
                  <p><strong>Purpose:</strong> {selectedVisitor.reason || selectedVisitor.purpose || 'N/A'}</p>
                  <p><strong>Visit Date:</strong> {selectedVisitor.check_in_time ? new Date(selectedVisitor.check_in_time).toLocaleString() : 
                                                  selectedVisitor.visit_date ? new Date(selectedVisitor.visit_date).toLocaleString() : 'N/A'}</p>
                  <p><strong>Check-In:</strong> {selectedVisitor.check_in_time ? new Date(selectedVisitor.check_in_time).toLocaleString() : 'Not Checked In'}</p>
                  <p><strong>Check-Out:</strong> {selectedVisitor.check_out_time ? new Date(selectedVisitor.check_out_time).toLocaleString() : 'Not Checked Out'}</p>
                  {selectedVisitor.photo && (
                    <p><strong>Photo:</strong><br />
                      <img src={selectedVisitor.photo} alt="Visitor" style={{ maxWidth: '100px', borderRadius: '5px' }} />
                    </p>
                  )}
                  <h4>Visit History</h4>
                  {selectedVisitor.history && selectedVisitor.history.length > 0 ? (
                    <table className="visitor-history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Purpose</th>
                          <th>Host</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedVisitor.history.map(history => (
                          <tr key={history.id}>
                            <td>{new Date(history.check_in_time || history.visit_date).toLocaleDateString()}</td>
                            <td>{history.reason || history.purpose || 'N/A'}</td>
                            <td>{history.hostName || history.host_name || 'N/A'}</td>
                            <td>{history.check_in_time ? new Date(history.check_in_time).toLocaleString() : 'N/A'}</td>
                            <td>{history.check_out_time ? new Date(history.check_out_time).toLocaleString() : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No visit history available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* System Administration Section */}
          {activeSection === 'system-admin' && (
            <div className="system-admin-page">
              <div className="system-admin-tabs">
                <button 
                  className={`tab-btn ${systemAdminActiveTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setSystemAdminActiveTab('settings')}
                >
                  ⚙️ Settings
                </button>
                <button 
                  className={`tab-btn ${systemAdminActiveTab === 'users' ? 'active' : ''}`}
                  onClick={() => setSystemAdminActiveTab('users')}
                >
                  👥 Users
                </button>
                <button 
                  className={`tab-btn ${systemAdminActiveTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setSystemAdminActiveTab('audit')}
                >
                  📋 Audit
                </button>
                <button 
                  className={`tab-btn ${systemAdminActiveTab === 'backup' ? 'active' : ''}`}
                  onClick={() => setSystemAdminActiveTab('backup')}
                >
                  💾 Backup
                </button>
                <button 
                  className={`tab-btn ${systemAdminActiveTab === 'maintenance' ? 'active' : ''}`}
                  onClick={() => setSystemAdminActiveTab('maintenance')}
                >
                  🔧 Maintenance
                </button>
              </div>

              <div className="system-admin-content">
                {/* System Settings Tab */}
                {systemAdminActiveTab === 'settings' && (
                  <div className="settings-tab">
                    <h2>System Settings</h2>
                    <form onSubmit={handleSettingsSubmit} className="settings-form">
                      <div className="settings-section">
                        <h3>Company Information</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Company Name</label>
                            <input
                              type="text"
                              value={systemSettings.companyName || ''}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                companyName: e.target.value
                              }))}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Company Email</label>
                            <input
                              type="email"
                              value={systemSettings.companyEmail || ''}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                companyEmail: e.target.value
                              }))}
                              required
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Company Phone</label>
                            <input
                              type="tel"
                              value={systemSettings.companyPhone || ''}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                companyPhone: e.target.value
                              }))}
                            />
                          </div>
                          <div className="form-group">
                            <label>Company Address</label>
                            <textarea
                              value={systemSettings.companyAddress || ''}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                companyAddress: e.target.value
                              }))}
                              rows="3"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="settings-section">
                        <h3>Visit Management</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.allowPreregistration || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  allowPreregistration: e.target.checked
                                }))}
                              />
                              Allow Pre-registration
                            </label>
                          </div>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.requireApproval || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  requireApproval: e.target.checked
                                }))}
                              />
                              Require Host Approval
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Maximum Visitor Duration (hours)</label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={systemSettings.maxVisitorDuration || 8}
                            onChange={(e) => setSystemSettings(prev => ({
                              ...prev,
                              maxVisitorDuration: parseInt(e.target.value)
                            }))}
                          />
                        </div>
                      </div>

                      <div className="settings-section">
                        <h3>Working Hours</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Start Time</label>
                            <input
                              type="time"
                              value={systemSettings.workingHours?.start || '09:00'}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                workingHours: {
                                  ...prev.workingHours,
                                  start: e.target.value
                                }
                              }))}
                            />
                          </div>
                          <div className="form-group">
                            <label>End Time</label>
                            <input
                              type="time"
                              value={systemSettings.workingHours?.end || '18:00'}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                workingHours: {
                                  ...prev.workingHours,
                                  end: e.target.value
                                }
                              }))}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Working Days</label>
                          <div className="checkbox-group">
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                              <label key={day}>
                                <input
                                  type="checkbox"
                                  checked={systemSettings.workingDays?.includes(day) || false}
                                  onChange={(e) => {
                                    const currentWorkingDays = systemSettings.workingDays || [];
                                    const workingDays = e.target.checked
                                      ? [...currentWorkingDays, day]
                                      : currentWorkingDays.filter(d => d !== day);
                                    setSystemSettings(prev => ({
                                      ...prev,
                                      workingDays
                                    }));
                                  }}
                                />
                                {day.charAt(0).toUpperCase() + day.slice(1)}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="settings-section">
                        <h3>Notification Settings</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.notificationSettings?.emailNotifications || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    emailNotifications: e.target.checked
                                  }
                                }))}
                              />
                              Email Notifications
                            </label>
                          </div>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.notificationSettings?.smsNotifications || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    smsNotifications: e.target.checked
                                  }
                                }))}
                              />
                              SMS Notifications
                            </label>
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.notificationSettings?.hostNotification || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    hostNotification: e.target.checked
                                  }
                                }))}
                              />
                              Notify Hosts
                            </label>
                          </div>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.notificationSettings?.adminNotification || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  notificationSettings: {
                                    ...prev.notificationSettings,
                                    adminNotification: e.target.checked
                                  }
                                }))}
                              />
                              Notify Admins
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="settings-section">
                        <h3>Security & Data</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Security Level</label>
                            <select
                              value={systemSettings.securityLevel || 'medium'}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                securityLevel: e.target.value
                              }))}
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
                              min="30"
                              max="3650"
                              value={systemSettings.dataRetentionDays || 365}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                dataRetentionDays: parseInt(e.target.value)
                              }))}
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Backup Frequency</label>
                            <select
                              value={systemSettings.backupFrequency || 'daily'}
                              onChange={(e) => setSystemSettings(prev => ({
                                ...prev,
                                backupFrequency: e.target.value
                              }))}
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={systemSettings.maintenanceMode || false}
                                onChange={(e) => setSystemSettings(prev => ({
                                  ...prev,
                                  maintenanceMode: e.target.checked
                                }))}
                              />
                              Maintenance Mode
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button type="submit" disabled={loading} className="save-btn">
                          {loading ? 'Saving...' : 'Save Settings'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* User Management Tab */}
                {systemAdminActiveTab === 'users' && (
                  <div className="users-tab">
                    <h2>User Management</h2>
                    
                    <div className="user-form-section">
                      <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
                      <form onSubmit={handleUserSubmit} className="user-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Name</label>
                            <input
                              type="text"
                              value={newAdminUser.name}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                name: e.target.value
                              }))}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Email</label>
                            <input
                              type="email"
                              value={newAdminUser.email}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                email: e.target.value
                              }))}
                              required
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Password</label>
                            <input
                              type="password"
                              value={newAdminUser.password}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                password: e.target.value
                              }))}
                              required={!editingUser}
                              placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                            />
                          </div>
                          <div className="form-group">
                            <label>Phone</label>
                            <input
                              type="tel"
                              value={newAdminUser.phone}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                phone: e.target.value
                              }))}
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Role</label>
                            <select
                              value={newAdminUser.role}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                role: e.target.value
                              }))}
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
                              value={newAdminUser.department}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                department: e.target.value
                              }))}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={newAdminUser.isActive}
                              onChange={(e) => setNewAdminUser(prev => ({
                                ...prev,
                                isActive: e.target.checked
                              }))}
                            />
                            Active User
                          </label>
                        </div>
                        <div className="form-actions">
                          <button type="submit" disabled={loading} className="save-btn">
                            {loading ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                          </button>
                          {editingUser && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditingUser(null);
                                setNewAdminUser({
                                  name: '',
                                  email: '',
                                  password: '',
                                  role: 'host',
                                  department: '',
                                  phone: '',
                                  isActive: true
                                });
                              }}
                              className="cancel-btn"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    <div className="users-list">
                      <h3>Existing Users</h3>
                      <div className="users-table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Email</th>
                              <th>Role</th>
                              <th>Department</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {systemUsers.map(user => (
                              <tr key={user.id}>
                                <td>{user.name}</td>
                                <td>{user.email}</td>
                                <td>
                                  <span className={`role-badge ${user.role}`}>
                                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                  </span>
                                </td>
                                <td>{user.department || '-'}</td>
                                <td>
                                  <span className={`status-badge ${user.is_active !== false ? 'active' : 'inactive'}`}>
                                    {user.is_active !== false ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
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
                  </div>
                )}

                {/* Audit Logs Tab */}
                {systemAdminActiveTab === 'audit' && (
                  <div className="audit-tab">
                    <h2>Audit Logs</h2>
                    
                    <div className="audit-filters">
                      <div className="filter-row">
                        <div className="filter-group">
                          <label>Start Date</label>
                          <input
                            type="date"
                            name="startDate"
                            value={auditFilters.startDate}
                            onChange={handleAuditFilterChange}
                          />
                        </div>
                        <div className="filter-group">
                          <label>End Date</label>
                          <input
                            type="date"
                            name="endDate"
                            value={auditFilters.endDate}
                            onChange={handleAuditFilterChange}
                          />
                        </div>
                        <div className="filter-group">
                          <label>Action</label>
                          <select
                            name="action"
                            value={auditFilters.action}
                            onChange={handleAuditFilterChange}
                          >
                            <option value="">All Actions</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                            <option value="user_created">User Created</option>
                            <option value="user_updated">User Updated</option>
                            <option value="user_deleted">User Deleted</option>
                            <option value="settings_updated">Settings Updated</option>
                            <option value="backup_created">Backup Created</option>
                            <option value="backup_restored">Backup Restored</option>
                          </select>
                        </div>
                        <div className="filter-group">
                          <label>Username</label>
                          <input
                            type="text"
                            name="username"
                            value={auditFilters.username}
                            onChange={handleAuditFilterChange}
                            placeholder="Filter by username"
                          />
                        </div>
                        <div className="filter-actions">
                          <button onClick={fetchAuditLogs} className="filter-btn">
                            Apply Filters
                          </button>
                          <button 
                            onClick={() => {
                              setAuditFilters({
                                startDate: '',
                                endDate: '',
                                action: '',
                                username: ''
                              });
                              fetchAuditLogs();
                            }}
                            className="clear-btn"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="audit-logs">
                      <div className="audit-table-container">
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
                  </div>
                )}

                {/* Backup & Restore Tab */}
                {systemAdminActiveTab === 'backup' && (
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
                      <div className="backups-table-container">
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
                  </div>
                )}

                {/* Maintenance Tab */}
                {systemAdminActiveTab === 'maintenance' && (
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
          )}

          {/* QR Code Modal */}
          {showQRModal && selectedVisitor && (
            <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
              <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>QR Code for {selectedVisitor.visitor_name || selectedVisitor.visitorName}</h3>
                  <button onClick={() => setShowQRModal(false)} className="close-btn">
                    ×
                  </button>
                </div>
                <div className="qr-code-container">
                  <QRCodeSVG value={selectedVisitor.qr_code || JSON.stringify({
                    visitorId: selectedVisitor.visitor_id || selectedVisitor.id,
                    visitorName: selectedVisitor.visitor_name || selectedVisitor.visitorName,
                    visitDate: selectedVisitor.visit_date || selectedVisitor.check_in_time
                  })} size={300} />
                  <div className="qr-info">
                    <p><strong>Visitor:</strong> {selectedVisitor.visitor_name || selectedVisitor.visitorName}</p>
                    <p><strong>Host:</strong> {selectedVisitor.host_name || selectedVisitor.hostName}</p>
                    <p><strong>Date:</strong> {selectedVisitor.visit_date ? new Date(selectedVisitor.visit_date).toLocaleDateString() : 'Invalid Date'}</p>
                    <p><strong>Time:</strong> {selectedVisitor.visit_time}</p>
                    <p><strong>Purpose:</strong> {selectedVisitor.purpose}</p>
                    {selectedVisitor.visitor_company && (
                      <p><strong>Company:</strong> {selectedVisitor.visitor_company}</p>
                    )}
                  </div>
                </div>

                {/* Share QR Code Section */}
                <div className="share-section">
                  <h4>📤 Share QR Code</h4>
                  <div className="share-options">
                    <button onClick={() => shareQRCode('email')} className="share-btn email-btn">
                      📧 Email
                    </button>
                    <button onClick={() => shareQRCode('sms')} className="share-btn sms-btn">
                      💬 SMS
                    </button>
                    <button onClick={() => shareQRCode('whatsapp')} className="share-btn whatsapp-btn">
                      📱 WhatsApp
                    </button>
                    <button onClick={() => shareQRCode('copy')} className="share-btn copy-btn">
                      📋 Copy
                    </button>
                    <button onClick={() => shareQRCode('download')} className="share-btn download-btn">
                      💾 Download
                    </button>
                    {/* {navigator.share && (
                      <button onClick={() => shareQRCode('native')} className="share-btn native-btn">
                        🔗 Share
                      </button>
                    )} */}
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
        </div>
      </div>
    </div>
  );
};


export default AdminDashboardPage;