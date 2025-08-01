// The base URL for your backend API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://visitor-management-system-version-2.onrender.com/api';

/**
 * A centralized request function to handle all API calls.
 * It automatically adds the JWT Authorization header if a token exists.
 * @param {string} endpoint - The API endpoint to call (e.g., '/login').
 * @param {object} options - Configuration for the fetch request (method, body, etc.).
 * @returns {Promise<any>} The JSON response from the server.
 * @throws {Error} Throws an error if the network request fails or the server returns an error.
 */
const request = async (endpoint, options = {}) => {
  // Retrieve the token from local storage on each request
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // If a token exists, add it to the Authorization header
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    // Handle cases where the server might not return JSON (e.g., server down)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        // Attempt to get text for better error logging
        const errorText = await response.text();
        console.error("Server returned a non-JSON response:", errorText);
        throw new Error('Server response was not in the expected JSON format.');
    }

    const responseData = await response.json();

    if (!response.ok) {
        // Use the server's error message if available, otherwise a generic one
        throw new Error(responseData.message || 'An unknown API error occurred.');
    }

    return responseData;
  } catch (error) {
    console.error(`API request to ${endpoint} failed:`, error);
    // Re-throw the error so it can be caught by the calling component (e.g., in a try/catch block)
    throw error;
  }
};

/**
 * Logs in a user.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 */
export const loginUser = (email, password) => {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

/**
 * **FIXED**: This function is for the public-facing registration page.
 * It assumes the page provides separate firstName and lastName fields.
 * @param {object} userData - Raw user data, expected to include { firstName, lastName, email, password }.
 */
export const registerUser = (userData) => {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

/**
 * **NEW**: This function is for the company registration page.
 * It sends all form data to the new company registration endpoint.
 * @param {object} companyData - Raw form data from the RegistrationPage.
 */
export const registerCompany = (companyData) => {
    return request('/registerCompany', {
        method: 'POST',
        body: JSON.stringify(companyData),
    });
};


/**
 * This function is for the Admin Dashboard to create hosts from a single 'name' field.
 * It correctly structures the name into firstName and lastName for the backend.
 * Now requires authentication as only admins can create users under their company.
 * @param {object} userData - Must contain name, email, and password.
 */
export const createUser = (userData) => {
  const [firstName, ...lastNameParts] = userData.name.split(' ');
  const lastName = lastNameParts.join(' ');

  const registrationData = {
    firstName,
    lastName,
    email: userData.email,
    password: userData.password,
  };

  return request('/register', {
    method: 'POST',
    body: JSON.stringify(registrationData),
  });
};

/**
 * Fetches all users (admin only).
 */
export const getUsers = () => {
  return request('/users');
};

/**
 * Fetches all hosts from the current user's company.
 * This is used for the host dropdown in visitor check-in forms.
 */
export const getHosts = () => {
  return request('/hosts');
};

/**
 * Fetches visits based on the user's role.
 * - 'admin' role fetches from /visits and can use all filters.
 * - 'host' role fetches from /host-visits.
 * @param {string} role - The role of the logged-in user ('admin' or 'host').
 * @param {object} filters - Optional filters for the query (e.g., { hostName: 'John' }).
 */
export const getVisits = (role, filters = {}) => {
  const params = new URLSearchParams(filters);
  
  // Choose the correct endpoint based on the user's role
  const endpoint = role === 'admin' ? '/visits' : '/host-visits';

  return request(`${endpoint}?${params.toString()}`);
};

/**
 * Creates a new visit record (check-in).
 * @param {object} checkInData - The data for the new visit.
 */
export const checkInVisitor = (checkInData) => {
  return request('/visits', {
    method: 'POST',
    body: JSON.stringify(checkInData),
  });
};

/**
 * Checks out a visit.
 * @param {number|string} visitId - The ID of the visit to check out.
 */
export const checkOutVisit = (visitId) => {
  return request(`/visits/${visitId}/checkout`, {
    method: 'PUT',
  });
};

/**
 * Blacklist or unblacklist a visitor.
 * @param {number|string} visitorId - The ID of the visitor to blacklist/unblacklist.
 * @param {boolean} isBlacklisted - Whether to blacklist (true) or unblacklist (false) the visitor.
 */
export const updateVisitorBlacklist = (visitorId, isBlacklisted) => {
  return request(`/visitors/${visitorId}/blacklist`, {
    method: 'PUT',
    body: JSON.stringify({ isBlacklisted }),
  });
};

// ============== REPORTING & ANALYTICS ==============

/**
 * Get comprehensive reports data
 */
export const getReports = (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  return request(`/reports?${queryParams}`);
};

/**
 * Export report data and trigger download
 */
export const exportReport = async (type, format, filters = {}) => {
  const queryParams = new URLSearchParams({ ...filters, type, format }).toString();
  
  try {
    const response = await fetch(`${API_BASE_URL}/reports/export?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    // Get the blob from the response
    const blob = await response.blob();
    
    // Create a download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Set filename based on format
    const timestamp = new Date().toISOString().split('T')[0];
    let filename;
    if (format === 'pdf') {
      filename = `visitor-report-${timestamp}.html`;
    } else if (format === 'excel') {
      filename = `visitor-report-${timestamp}.csv`;
    } else {
      filename = `visitor-report-${timestamp}.txt`;
    }
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'Export completed successfully' };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

// ============== ADVANCED VISITOR FEATURES ==============

/**
 * Pre-register a visitor
 */
export const preRegisterVisitor = (visitorData) => {
  return request('/visitors/pre-register', {
    method: 'POST',
    body: JSON.stringify(visitorData),
  });
};

/**
 * QR Code Check-in
 */
export const qrCheckIn = (qrData) => {
  return request('/visitors/qr-checkin', {
    method: 'POST',
    body: JSON.stringify(qrData),
  });
};

/**
 * Get all pre-registrations
 */
export const getPreRegistrations = (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  return request(`/visitors/pre-registrations?${queryParams}`);
};

/**
 * Generate visitor badge
 */
export const generateVisitorBadge = (visitId) => {
  return request(`/visitors/${visitId}/badge`);
};

/**
 * Generate badge for pre-registered visitor
 */
export const generatePreRegistrationBadge = (preRegId) => {
  return request(`/pre-registrations/${preRegId}/badge`);
};

/**
 * Get recurring visits
 */
export const getRecurringVisits = () => {
  return request('/visitors/recurring');
};

/**
 * Update recurring visit
 */
export const updateRecurringVisit = (id, updateData) => {
  return request(`/visitors/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
};

/**
 * Generate recurring visit instances
 */
export const generateRecurringInstances = (id) => {
  return request(`/visitors/recurring/${id}/generate`, {
    method: 'POST',
  });
};

/**
 * Get visitor history with filters
 */
export const getVisitorHistory = (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add non-empty filters to query params
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.toString().trim() !== '') {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const url = `/visitors/history${queryString ? '?' + queryString : ''}`;
  
  return request(url);
};

/**
 * Get pending visitors from pre-registrations
 */
export const getPendingVisitors = (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add non-empty filters to query params
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.toString().trim() !== '') {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const url = `/visitors/pending${queryString ? '?' + queryString : ''}`;
  
  return request(url);
};

/**
 * Get blacklisted visitors for admin's company
 */
export const getBlacklistedVisitors = (filters = {}) => {
  const queryParams = new URLSearchParams();
  
  // Add non-empty filters to query params
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.toString().trim() !== '') {
      queryParams.append(key, value);
    }
  });
  
  const queryString = queryParams.toString();
  const url = `/visitors/blacklisted${queryString ? '?' + queryString : ''}`;
  
  return request(url);
};

// ============== SYSTEM ADMINISTRATION ==============

/**
 * Get system settings
 */
export const getSystemSettings = () => {
  return request('/admin/settings');
};

/**
 * Update system settings
 */
export const updateSystemSettings = (settings) => {
  return request('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
};

/**
 * Create a new admin user (enhanced version for system admin)
 */
export const createAdminUser = (userData) => {
  return request('/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

/**
 * Update a user (enhanced version for system admin)
 */
export const updateUser = (userId, userData) => {
  return request(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
};

/**
 * Delete a user
 */
export const deleteUser = (userId) => {
  return request(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
};

/**
 * Get audit logs
 */
export const getAuditLogs = (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  return request(`/admin/audit-logs?${queryParams}`);
};

/**
 * Export system data
 */
export const exportSystemData = () => {
  return request('/admin/export');
};

/**
 * Import system data
 */
export const importSystemData = (data) => {
  return request('/admin/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Get system backups
 */
export const getSystemBackups = () => {
  return request('/admin/backups');
};

/**
 * Create a system backup
 */
export const createBackup = () => {
  return request('/admin/backups', {
    method: 'POST',
  });
};

/**
 * Restore from backup
 */
export const restoreBackup = (backupId) => {
  return request(`/admin/backups/${backupId}/restore`, {
    method: 'POST',
  });
};
