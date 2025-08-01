import React, { useState, useEffect } from 'react';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { Link, useNavigate } from 'react-router-dom';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { getReports, exportReport } from '../utils/apiService';
// import AdminSidebar from '../components/AdminSidebar';
import '../styles/ReportsPage.css';
import '../styles/AdminDashboardPage.css';
// import '../styles/AdminSidebar.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ReportsPage = () => {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('reports');
  
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const data = await getReports(dateRange);
      setReportData(data);
    } catch (err) {
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      setLoading(true);
      await exportReport('report', format, dateRange);
      // Note: The actual file download will be handled by the browser
    } catch (err) {
      setError('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const visitorTrendData = reportData ? {
    labels: reportData.dailyStats?.map(d => new Date(d.date).toLocaleDateString()) || [],
    datasets: [
      {
        label: 'Daily Visitors',
        data: reportData.dailyStats?.map(d => d.visits) || [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
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

  const navigateToVisitorLogs = () => {
    navigate('/admin', { 
      state: { activeSection: 'visitor-logs' }
    });
  };

  const navigateToUsers = () => {
    navigate('/admin', { 
      state: { activeSection: 'manage-users' }
    });
  };

  const navigateToVisitors = () => {
    navigate('/admin', { 
      state: { activeSection: 'visitors' }
    });
  };
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

  if (loading) return (
    <div className="admin-page-with-sidebar">
      {/* <AdminSidebar /> */}
      <div className="admin-main-content">
        <div className="reports-loading">Loading reports...</div>
      </div>
    </div>
  );

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
                        onClick={navigateToVisitorLogs}
                      >
                        📋 Visitor Logs 
                      </button>
                    </li>
                    <li>
                      <button 
                        className="sidebar-menu-btn" 
                        onClick={navigateToUsers}
                      >
                        👥 Manage Users 
                      </button>
                    </li>
                    <li>
                      <Link to="/reports" className="sidebar-link active reports-active">
                        📊 Reports & Analytics
                      </Link>
                    </li>
                    <li>
                      <Link to="/advanced-visitors" className="sidebar-link">
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
        <div className="reports-container">
          <div className="reports-header">
            <h1>Reports & Analytics</h1>
            <div className="reports-controls">
              <div className="date-range-controls">
                <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="export-controls">
            <button onClick={() => handleExport('pdf')} className="export-btn">
              📄 Export PDF
            </button>
            <button onClick={() => handleExport('excel')} className="export-btn">
              📊 Export Excel
            </button>
        </div>
        </div>
      </div>

      {error && <div className="reports-error">{error}</div>}

      <div className="reports-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'visitors' ? 'active' : ''} 
          onClick={() => setActiveTab('visitors')}
        >
          Visitor Analytics
        </button>
        <button 
          className={activeTab === 'hosts' ? 'active' : ''} 
          onClick={() => setActiveTab('hosts')}
        >
          Host Performance
        </button>
        <button 
          className={activeTab === 'security' ? 'active' : ''} 
          onClick={() => setActiveTab('security')}
        >
          Security Insights
        </button>
      </div>

      <div className="reports-content">
        {activeTab === 'overview' && reportData && (
          <div className="overview-tab">
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
                  -{reportData.incidentReduction}% from last period
                </div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-container">
                <h3>Visitor Trends (Last 30 Days)</h3>
                {visitorTrendData && <Line data={visitorTrendData} />}
              </div>
              <div className="chart-container">
                <h3>Visit Reasons Distribution</h3>
                {visitReasonData && <Doughnut data={visitReasonData} />}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'visitors' && reportData && (
          <div className="visitors-tab">
            <div className="visitor-analytics">
              <div className="chart-container">
                <h3>Daily Visitor Trends</h3>
                {visitorTrendData && <Line data={visitorTrendData} />}
              </div>
              <div className="visitor-metrics">
                <h3>Visitor Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <span>First-time Visitors</span>
                    <span>{reportData.overview?.uniqueVisitors || 0}</span>
                  </div>
                  <div className="metric-item">
                    <span>Returning Visitors</span>
                    <span>{(reportData.overview?.totalVisits || 0) - (reportData.overview?.uniqueVisitors || 0)}</span>
                  </div>
                  <div className="metric-item">
                    <span>Average Check-in Time</span>
                    <span>2:30 PM</span>
                  </div>
                  <div className="metric-item">
                    <span>No-shows</span>
                    <span>0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hosts' && reportData && (
          <div className="hosts-tab">
            <div className="host-performance">
              <div className="chart-container">
                <h3>Host Activity</h3>
                {hostActivityData && <Bar data={hostActivityData} />}
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

        {activeTab === 'security' && reportData && (
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

export default ReportsPage;
