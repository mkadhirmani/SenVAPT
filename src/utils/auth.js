// Authentication, Roles & Permissions Management for Autonomous VAPT Dashboard

const USERS_STORAGE_KEY = 'sennovate_vapt_users';
const CURRENT_USER_KEY = 'sennovate_current_user';
const AUTH_TOKEN_KEY = 'sennovate_auth_token';
const SESSIONS_STORAGE_KEY = 'sennovate_active_sessions';

export const ALL_PERMISSIONS = [
  { id: 'run_scans', label: 'Run AI Scans', description: 'Launch new autonomous security audits' },
  { id: 'view_findings', label: 'View Findings', description: 'Inspect vulnerabilities and remediation steps' },
  { id: 'attack_graph', label: 'Attack Graph', description: 'Access interactive attack chains' },
  { id: 'ai_assistant', label: 'AI Assistant', description: 'Interact with AI Security Assistant' },
  { id: 'export_reports', label: 'Export Reports', description: 'Download executive PDF reports' },
  { id: 'view_tokens', label: 'View AI Tokens & Cost', description: 'Inspect raw token telemetry & compute pricing' },
  { id: 'view_terminal', label: 'View Live Terminal', description: 'Inspect raw bash execution & debug terminal' },
  { id: 'manage_settings', label: 'Manage Server & LLM', description: 'Configure SSH servers and LLM API keys' },
  { id: 'manage_users', label: 'Admin User Management', description: 'Manage users, sessions and permission grants' },
  { id: 'load_custom_folder', label: 'Load Raw Scans', description: 'Import arbitrary local or remote scan directories' },
];

export const DEFAULT_USERS = [
  {
    id: 'admin',
    username: 'admin',
    email: 'admin@sennovate.com',
    name: 'Administrator',
    role: 'admin',
    title: 'Administrator',
    createdAt: '2026-08-01 08:00:00',
    lastLogin: '2026-08-26 09:30:00',
    isOnline: true,
    scansCount: 0,
    permissions: {
      run_scans: true,
      view_findings: true,
      attack_graph: true,
      ai_assistant: true,
      export_reports: true,
      view_tokens: true,
      view_terminal: true,
      manage_settings: true,
      manage_users: true,
      load_custom_folder: true,
    }
  },
  {
    id: 'user',
    username: 'user',
    email: 'user@sennovate.com',
    name: 'User',
    role: 'user',
    title: 'Standard User',
    createdAt: '2026-08-10 09:30:00',
    lastLogin: '2026-08-26 09:30:00',
    isOnline: true,
    scansCount: 0,
    assignedTargets: ['General Compliance & Security Audit'],
    permissions: {
      run_scans: true,
      view_findings: true,
      attack_graph: true,
      ai_assistant: true,
      export_reports: true,
      view_tokens: false,
      view_terminal: false,
      manage_settings: false,
      manage_users: false,
      load_custom_folder: false
    }
  },
  {
    id: 'sales123',
    username: 'sales123',
    email: 'sales@sennovate.com',
    name: 'Sales Team',
    role: 'sales',
    title: 'Sales & BD Specialist',
    createdAt: '2026-08-27 10:00:00',
    lastLogin: '2026-08-27 10:00:00',
    isOnline: true,
    scansCount: 0,
    assignedTargets: ['Commercial Demos & Sales Audits'],
    permissions: {
      run_scans: true,
      view_findings: true,
      attack_graph: true,
      ai_assistant: true,
      export_reports: true,
      view_tokens: true,
      view_terminal: false,
      manage_settings: false,
      manage_users: false,
      load_custom_folder: false
    }
  }
];

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token) {
  if (token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch (_) {}
  }
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Verify session token cryptographically with server.
 * Prevents sessionStorage injection / auth bypass.
 */
export async function verifySessionWithServer() {
  const token = getAuthToken();
  if (!token) {
    setCurrentUser(null);
    setAuthToken(null);
    return null;
  }

  try {
    const res = await fetch('/api/auth/verify-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      setCurrentUser(null);
      setAuthToken(null);
      return null;
    }

    const data = await res.json();
    if (data && data.success && data.user) {
      return setCurrentUser(data.user);
    }
  } catch (e) {
    console.warn('Session verification error:', e);
  }
  setCurrentUser(null);
  setAuthToken(null);
  return null;
}

/**
 * Fetch users list from backend server (.users_store.json) and synchronize with localStorage
 */
export async function fetchGlobalUsersList() {
  try {
    const res = await fetch('/api/users/get-users', {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.users) && data.users.length > 0) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data.users));
        return data.users;
      }
    }
  } catch (e) {
    console.warn('Note syncing global users from server:', e);
  }
  return getUsersList();
}

/**
 * Get all users from storage or fallback to defaults
 */
export function getUsersList() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    let list = DEFAULT_USERS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed.filter(u => u && u.username !== 'user1' && u.username !== 'user2');
      }
    }

    // Ensure default 'admin', 'user', and 'sales123' accounts exist
    const hasAdmin = list.some(u => u.username === 'admin');
    const hasUser = list.some(u => u.username === 'user');
    const hasSales = list.some(u => u.username === 'sales123');
    if (!hasAdmin || !hasUser || !hasSales) {
      const missing = DEFAULT_USERS.filter(du => !list.some(u => u.username === du.username));
      list = [...list, ...missing];
      saveUsersList(list);
    }

    return list.map(u => ({
      ...u,
      avatar: null,
      name: u.name || (u.role === 'admin' ? 'Administrator' : u.role === 'sales' ? 'Sales Team' : 'User')
    }));
  } catch (e) {
    console.error('Error fetching users list:', e);
  }
  saveUsersList(DEFAULT_USERS);
  return DEFAULT_USERS;
}

/**
 * Save users list to localStorage and sync to backend server
 */
export function saveUsersList(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    // Persist to server store (.users_store.json) if admin
    const token = getAuthToken();
    if (token) {
      fetch('/api/users/save-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ users })
      }).catch(err => console.warn('Note syncing users to backend:', err));
    }
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

/**
 * Get the currently logged-in user from active session
 */
export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) {
        const allUsers = getUsersList();
        const fresh = allUsers.find(u => u.id === user.id || u.username === user.username);
        return fresh || user;
      }
    }
  } catch (e) {
    console.error('Error fetching current user:', e);
  }
  return null;
}

/**
 * Set the current user session
 */
export function setCurrentUser(user) {
  try {
    if (user) {
      const allUsers = getUsersList();
      const updatedList = allUsers.map(u => {
        if (u.id === user.id || u.username === user.username) {
          return { ...u, isOnline: true, lastLogin: new Date().toISOString().replace('T', ' ').slice(0, 19) };
        }
        return u;
      });
      saveUsersList(updatedList);

      const freshUser = updatedList.find(u => u.id === user.id || u.username === user.username) || user;
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(freshUser));
      try { localStorage.removeItem(CURRENT_USER_KEY); } catch (_) { }

      trackSessionLogin(freshUser.id);
      return freshUser;
    } else {
      sessionStorage.removeItem(CURRENT_USER_KEY);
      try { localStorage.removeItem(CURRENT_USER_KEY); } catch (_) { }
    }
  } catch (e) {
    console.error('Error setting current user:', e);
  }
  return user;
}

/**
 * Log out current user
 */
export async function logoutUser() {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (_) {}
  }
  setAuthToken(null);

  const current = getCurrentUser();
  if (current) {
    trackSessionLogout(current.id);
    const users = getUsersList();
    const updated = users.map(u => u.id === current.id ? { ...u, isOnline: false } : u);
    saveUsersList(updated);
  }
  sessionStorage.removeItem(CURRENT_USER_KEY);
  try { localStorage.removeItem(CURRENT_USER_KEY); } catch (_) { }
}

/**
 * Authenticate user credentials securely via backend /api/auth/login
 */
export async function authenticateUser(usernameOrEmail, password, selectedRole = null) {
  const trimmedInput = (usernameOrEmail || '').trim();
  const trimmedPass = (password || '').trim();

  if (!trimmedInput || !trimmedPass) {
    throw new Error('Please enter both username and password.');
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: trimmedInput,
        password: trimmedPass,
        selectedRole
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.user) {
      throw new Error(data?.error || 'Invalid credentials. Please enter a valid username and password.');
    }

    if (data.token) {
      setAuthToken(data.token);
    }

    return setCurrentUser(data.user);
  } catch (err) {
    throw new Error(err.message || 'Authentication failed. Please check your credentials.');
  }
}

/**
 * Update permissions for a specific user (Admin only)
 */
export function updateUserPermissions(userId, newPermissions) {
  const users = getUsersList();
  const updated = users.map(u => {
    if (u.id === userId) {
      return {
        ...u,
        permissions: {
          ...u.permissions,
          ...newPermissions
        }
      };
    }
    return u;
  });
  saveUsersList(updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    const updatedCurrent = updated.find(u => u.id === userId);
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedCurrent));
  }

  return updated;
}

/**
 * Update password for any user or admin
 */
export function updateUserPassword(userIdOrUsername, newPassword) {
  if (!newPassword || !newPassword.trim()) {
    throw new Error('New password cannot be empty.');
  }

  const users = getUsersList();
  const trimmed = newPassword.trim();
  let found = false;

  const updated = users.map(u => {
    if (u.id === userIdOrUsername || u.username.toLowerCase() === userIdOrUsername.toLowerCase()) {
      found = true;
      return {
        ...u,
        password: trimmed
      };
    }
    return u;
  });

  if (!found) {
    throw new Error(`User "${userIdOrUsername}" not found.`);
  }

  saveUsersList(updated);

  const current = getCurrentUser();
  if (current && (current.id === userIdOrUsername || current.username.toLowerCase() === userIdOrUsername.toLowerCase())) {
    const updatedCurrent = updated.find(u => u.id === current.id || u.username.toLowerCase() === current.username.toLowerCase());
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedCurrent));
  }

  return updated;
}

/**
 * Add a new user
 */
export function createNewUser(userData) {
  const users = getUsersList();
  const newUser = {
    id: `user-${Date.now()}`,
    username: userData.username.toLowerCase().trim(),
    email: userData.email || `${userData.username.toLowerCase().trim()}@sennovate.com`,
    password: userData.password || '',
    name: userData.name || userData.username,
    role: userData.role || 'user',
    title: userData.title || 'Security Analyst',
    avatar: userData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.username}`,
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    lastLogin: 'Never',
    isOnline: false,
    scansCount: 0,
    permissions: userData.permissions || {
      run_scans: true,
      view_findings: true,
      attack_graph: true,
      ai_assistant: true,
      export_reports: true,
      view_tokens: false,
      view_terminal: false,
      manage_settings: false,
      manage_users: false,
      load_custom_folder: false
    }
  };

  const updated = [...users, newUser];
  saveUsersList(updated);
  return updated;
}

/**
 * Delete a user
 */
export function deleteUser(userId) {
  if (userId === 'admin') {
    throw new Error('Cannot delete root Administrator account');
  }
  const users = getUsersList();
  const updated = users.filter(u => u.id !== userId);
  saveUsersList(updated);
  return updated;
}

/**
 * Helper to check if current user has a specific permission
 */
export function checkUserPermission(user, permissionId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.permissions && user.permissions[permissionId]);
}

/**
 * Active Session Helpers
 */
function trackSessionLogin(userId) {
  try {
    let sessions = JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) || '[]');
    if (!sessions.includes(userId)) {
      sessions.push(userId);
    }
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) { }
}

function trackSessionLogout(userId) {
  try {
    let sessions = JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) || '[]');
    sessions = sessions.filter(id => id !== userId);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) { }
}

export function getActiveSessionCount() {
  try {
    const users = getUsersList();
    const onlineCount = users.filter(u => u.isOnline).length;
    return Math.max(1, onlineCount);
  } catch (e) {
    return 1;
  }
}
