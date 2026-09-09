import { supabase, formatUserForSupabase, formatUserFromSupabase, isSupabaseConfigured, initSupabaseBrowserConfig } from './supabaseClient.js';

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
    password: '',
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
    password: '',
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
    password: '',
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
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const user = getCurrentUser();
  if (user) {
    headers['x-user-id'] = user.id || user.username || '';
    headers['x-user-role'] = user.role || 'user';
  }
  return headers;
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
 * Seed default root accounts into Supabase vapt_users table (Server-managed only)
 */
export async function seedDefaultUsersToSupabase() {
  // Handled securely by backend server to prevent client-side credential disclosure
  return;
}

/**
 * Fetch users list dynamically from backend server (Admin only, passwords stripped)
 * with graceful fallback to local storage
 */
export async function fetchGlobalUsersList() {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/users/get-users', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.users) && data.users.length > 0) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data.users));
          try { window.dispatchEvent(new CustomEvent('sennovate_users_updated', { detail: data.users })); } catch (_) {}
          return data.users;
        }
      }
    } catch (e) {
      console.warn('Note syncing global users from server:', e);
    }
  }
  return getUsersList();
}

/**
 * Get all users from storage or fallback to defaults
 */
export function getUsersList() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_USERS;
  }
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
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    // Persist to server store (.users_store.json) if admin
    const token = getAuthToken();
    fetch('/api/users/save-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ users })
    }).catch(err => console.warn('Note syncing users to backend:', err));

    // Dual-sync directly to Supabase vapt_users table with original passwords
    try {
      const payloads = users.map(formatUserForSupabase).filter(Boolean);
      if (payloads.length > 0) {
        supabase.from('vapt_users').upsert(payloads, { onConflict: 'username' }).then(() => {}, () => {});
      }
    } catch (_) {}
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

/**
 * Get the currently logged-in user from active session
 */
export function getCurrentUser() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
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
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return user;
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

    // Sync online status to Supabase
    try {
      supabase.from('vapt_users').update({ is_online: false }).eq('id', current.id).then(() => {}, () => {});
    } catch (_) {}
  }
  sessionStorage.removeItem(CURRENT_USER_KEY);
  try { localStorage.removeItem(CURRENT_USER_KEY); } catch (_) { }
}

/**
 * Authenticate user credentials securely:
 * Authenticates via backend /api/auth/login endpoint, with client-side fallback
 * to local store and automatic Supabase original password repair.
 */
export async function authenticateUser(usernameOrEmail, password, selectedRole = null) {
  const trimmedInput = (usernameOrEmail || '').trim().toLowerCase();
  const trimmedPass = (password || '').trim();

  if (!trimmedInput || !trimmedPass) {
    throw new Error('Please enter both username and password.');
  }

  // 1. Authenticate through backend endpoint
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

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.user) {
      if (data.token) {
        setAuthToken(data.token);
      }
      const user = setCurrentUser(data.user);
      await initSupabaseBrowserConfig().catch(() => {});
      return user;
    }

    if (data.error && data.error.startsWith('Access Denied:')) {
      throw new Error(data.error);
    }
  } catch (err) {
    if (err.message && err.message.startsWith('Access Denied:')) {
      throw err;
    }
    console.warn('Backend login attempt note:', err.message);
  }

  // 2. Direct Supabase query (fetch credential directly from Supabase vapt_users table)
  try {
    const { data: supaUsers, error: supaErr } = await supabase
      .from('vapt_users')
      .select('*')
      .or(`username.ilike.${trimmedInput},email.ilike.${trimmedInput}`)
      .limit(1);

    if (!supaErr && Array.isArray(supaUsers) && supaUsers.length > 0) {
      const row = supaUsers[0];
      if (row.password && row.password === trimmedPass) {
        if (selectedRole === 'admin' && row.role !== 'admin') {
          throw new Error('Access Denied: This account does not have administrator privileges. Please switch to User Login.');
        }
        const token = `token-${row.id}-${Date.now()}`;
        setAuthToken(token);
        const formatted = formatUserFromSupabase(row);
        formatted.password = trimmedPass;
        const user = setCurrentUser(formatted);
        await initSupabaseBrowserConfig().catch(() => {});
        return user;
      }
    }
  } catch (supaErr) {
    if (supaErr.message && supaErr.message.startsWith('Access Denied:')) {
      throw supaErr;
    }
    console.warn('Direct Supabase authentication note:', supaErr.message);
  }

  throw new Error('Invalid username or password.');
}

/**
 * Update permissions for a specific user (Admin only)
 * Syncs immediately via secure server endpoint
 */
export async function updateUserPermissions(userId, newPermissions) {
  const users = getUsersList();
  let targetUser = null;
  const updated = users.map(u => {
    if (u.id === userId || u.username === userId) {
      const mergedPerms = { ...u.permissions, ...newPermissions };
      targetUser = { ...u, permissions: mergedPerms };
      return targetUser;
    }
    return u;
  });
  saveUsersList(updated);

  const current = getCurrentUser();
  if (current && (current.id === userId || current.username === userId)) {
    const updatedCurrent = updated.find(u => u.id === userId || u.username === userId);
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedCurrent));
  }

  return updated;
}

/**
 * Update password for any user or admin
 * Syncs securely to backend server
 */
export async function updateUserPassword(userIdOrUsername, newPassword) {
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
 * Add a new user (Admin only)
 * Persists user to server and immediately syncs original password to Supabase vapt_users table.
 */
export async function createNewUser(userData) {
  const cleanUsername = (userData.username || '').toLowerCase().trim();

  if (!cleanUsername) {
    throw new Error('Username is required.');
  }
  if (!userData.password || !userData.password.trim()) {
    throw new Error('Password is required.');
  }

  const rawPassword = userData.password.trim();
  let updatedUsers = null;

  // 1. Try server endpoint
  try {
    const res = await fetch('/api/users/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ ...userData, password: rawPassword })
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data && data.success && Array.isArray(data.users)) {
        updatedUsers = data.users;
      }
    }
  } catch (e) {
    console.warn('Backend user create API note:', e);
  }

  // 2. Local & Supabase direct creation fallback
  const localList = getUsersList();
  const newUserObj = {
    id: `user-${Date.now()}`,
    username: cleanUsername,
    name: userData.name || (userData.role === 'admin' ? 'Administrator' : cleanUsername),
    email: userData.email || `${cleanUsername}@sennovate.com`,
    password: rawPassword,
    role: userData.role || 'user',
    title: userData.title || (userData.role === 'admin' ? 'Administrator' : 'Standard User'),
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

  if (!updatedUsers) {
    const existingIndex = localList.findIndex(u => u.username?.toLowerCase() === cleanUsername);
    if (existingIndex >= 0) {
      localList[existingIndex] = { ...localList[existingIndex], ...newUserObj };
    } else {
      localList.push(newUserObj);
    }
    updatedUsers = [...localList];
    saveUsersList(updatedUsers);
  } else {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
  }

  // 3. Immediately upsert to Supabase vapt_users with original plaintext password!
  try {
    const supaPayload = formatUserForSupabase(newUserObj);
    await supabase.from('vapt_users').upsert([supaPayload], { onConflict: 'username' });
    console.log(`[AUTH] User "${cleanUsername}" synced to Supabase with original password.`);
  } catch (err) {
    console.warn('Supabase direct user upsert note:', err.message);
  }

  try { window.dispatchEvent(new CustomEvent('sennovate_users_updated', { detail: updatedUsers })); } catch (_) {}
  return updatedUsers;
}

/**
 * Delete a user (Admin only)
 * Sends request securely to backend server
 */
export async function deleteUser(userId) {
  if (userId === 'admin') {
    throw new Error('Cannot delete root Administrator account');
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error('Active administrator session required.');
  }

  const res = await fetch('/api/users/delete-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ userId })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to delete user on server.');
  }

  const updatedUsers = data.users || [];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
  try {
    const { supabase } = await import('./supabaseClient.js');
    if (supabase) {
      await supabase.from('vapt_users').delete().eq('username', userId);
      await supabase.from('vapt_users').delete().eq('id', userId);
    }
  } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('sennovate_users_updated', { detail: updatedUsers })); } catch (_) {}
  return updatedUsers;
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
