import React, { useState } from 'react';
import { sortVulnerabilities } from '../utils/severityUtils';
import { 
  Users, 
  UserCheck, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Search, 
  Lock, 
  Sliders, 
  Terminal, 
  History, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  ArrowRight,
  Eye,
  EyeOff,
  Server,
  Layers,
  Sparkles,
  User,
  Shield,
  FileText,
  AlertTriangle,
  ChevronRight,
  Download,
  Upload,
  Database,
  X
} from 'lucide-react';
import { 
  getUsersList, 
  fetchGlobalUsersList,
  updateUserPermissions, 
  createNewUser, 
  deleteUser,
  ALL_PERMISSIONS, 
  getActiveSessionCount,
  getAuthHeaders
} from '../utils/auth';

export default function AdminUserManagement({ 
  currentUser, 
  scanHistory = [], 
  onSelectScan, 
  theme = 'light' 
}) {
  const [users, setUsers] = useState(() => getUsersList());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('user');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

  const handleRefreshUsers = async () => {
    setIsRefreshingUsers(true);
    try {
      const res = await fetchGlobalUsersList();
      if (Array.isArray(res) && res.length > 0) {
        setUsers(res);
        showFeedback(`Refreshed ${res.length} users from Supabase!`);
      }
    } catch (e) {
      showFeedback('Failed to refresh users list');
    } finally {
      setIsRefreshingUsers(false);
    }
  };

  React.useEffect(() => {
    fetchGlobalUsersList().then(res => {
      if (Array.isArray(res) && res.length > 0) {
        setUsers(res);
      }
    }).catch(() => {});

    const handleUpdate = (e) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setUsers(e.detail);
      } else {
        setUsers(getUsersList());
      }
    };
    const handleStorage = (e) => {
      if (e.key === 'sennovate_vapt_users' || e.key === 'sennovate_users_list') {
        setUsers(getUsersList());
      }
    };

    window.addEventListener('sennovate_users_updated', handleUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('sennovate_users_updated', handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // New user form state
  const [newUserData, setNewUserData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });

  const safeScanHistory = Array.isArray(scanHistory) ? scanHistory : [];
  const activeSessionsCount = (users || []).filter(u => u && u.isOnline).length || 1;

  const showFeedback = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleTogglePermission = async (userId, permId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    
    if (userId === 'admin' && permId === 'manage_users') {
      showFeedback('Cannot revoke Root Administrator privileges');
      return;
    }

    const currentVal = Boolean(targetUser.permissions?.[permId]);
    const updatedUsers = await updateUserPermissions(userId, { [permId]: !currentVal });
    setUsers(updatedUsers);
    showFeedback(`Permission '${permId}' updated for ${targetUser.username}`);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password) {
      showFeedback('Username and password are required');
      return;
    }

    try {
      const cleanUsername = newUserData.username.toLowerCase().trim();
      const updated = await createNewUser({
        username: cleanUsername,
        name: newUserData.role === 'admin' ? 'Administrator' : newUserData.username,
        email: newUserData.email || `${cleanUsername}@sennovate.com`,
        password: newUserData.password,
        role: newUserData.role,
        title: newUserData.role === 'admin' ? 'Administrator' : 'Standard User'
      });
      setUsers(updated);
      setSelectedUserId(cleanUsername);
      setIsAddUserOpen(false);
      setNewUserData({ username: '', email: '', password: '', role: 'user' });
      showFeedback(`User "${cleanUsername}" created with encrypted credentials!`);
    } catch (err) {
      showFeedback(err.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to remove this user account?')) {
      try {
        const updated = await deleteUser(userId);
        setUsers(updated);
        if (selectedUserId === userId) {
          setSelectedUserId('admin');
        }
        showFeedback('User account removed from Supabase vapt_users');
      } catch (err) {
        showFeedback(err.message);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];
  const selectedUserScans = safeScanHistory.filter(s => {
    if (!s || !selectedUser) return false;
    const uName = (selectedUser.username || '').toLowerCase();
    const uId = (selectedUser.id || '').toLowerCase();
    const createdBy = (s.createdBy || '').toLowerCase();
    const scannedBy = (s.scannedBy || '').toLowerCase();
    return createdBy === uName || createdBy === uId || scannedBy === uName || scannedBy === uId;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className={`p-6 sm:p-7 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all ${
        theme === 'dark' 
          ? 'bg-[#001B41] border-[#0A3778]' 
          : 'bg-white border-slate-200 shadow-xs'
      }`}>

        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[#006FE3] text-xs font-mono font-bold uppercase tracking-wider font-heading">
            <Lock className="w-3.5 h-3.5 flex-shrink-0 text-[#006FE3]" />
            <span>Admin Portal &bull; Identity &amp; Access Governance</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight truncate font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
            User Management &amp; Scan Findings Audit
          </h1>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-3xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage enterprise users and permission matrices in real-time. Click any user in the directory to inspect their verified findings and automated penetration test activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          {/* Export System Backup Button */}
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/system/export-backup', {
                  headers: { ...getAuthHeaders() }
                });
                if (res.ok) {
                  const data = await res.json();
                  const blob = new Blob([JSON.stringify(data.backup || data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Sennovate_VAPT_System_Backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showFeedback('System Snapshot Backup Downloaded Successfully!');
                } else {
                  throw new Error('Export API rejected (Requires Admin privileges)');
                }
              } catch (e) {
                showFeedback(`Backup Export Failed: ${e.message}`);
              }
            }}
            className={`flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-[#001127] hover:bg-[#002B66] text-slate-300 border-[#0A3778]' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
            title="Download full backup of all users, scans, and configurations"
          >
            <Download className="w-3.5 h-3.5 text-[#006FE3]" />
            <span className="font-heading font-bold">Export Backup</span>
          </button>

          {/* Import / Restore System Backup Button */}
          <label className={`flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
            theme === 'dark' 
              ? 'bg-[#001127] hover:bg-[#002B66] text-slate-300 border-[#0A3778]' 
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
          }`}>
            <Upload className="w-3.5 h-3.5 text-[#006FE3]" />
            <span className="font-heading font-bold">Restore Backup</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const json = JSON.parse(text);
                  const res = await fetch('/api/system/import-backup', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...getAuthHeaders()
                    },
                    body: JSON.stringify(json)
                  });
                  if (res.ok) {
                    showFeedback('System Snapshot Restored! Refreshing data...');
                    setTimeout(() => window.location.reload(), 1200);
                  } else {
                    throw new Error('Import API failed (Requires Admin privileges)');
                  }
                } catch (err) {
                  showFeedback(`Import Failed: ${err.message}`);
                }
              }}
            />
          </label>

          <button
            onClick={handleRefreshUsers}
            disabled={isRefreshingUsers}
            className={`flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-[#001127] hover:bg-[#002B66] text-slate-300 border-[#0A3778]' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
            title="Sync user list with live Supabase database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#006FE3] ${isRefreshingUsers ? 'animate-spin' : ''}`} />
            <span className="font-heading font-bold">{isRefreshingUsers ? 'Syncing...' : 'Sync Users'}</span>
          </button>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white text-xs font-bold font-heading transition-all shadow-md shadow-[#006FE3]/25 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-[#006FE3]/15 border border-[#006FE3]/40 text-[#006FE3] dark:text-[#80B7F1] text-xs font-mono font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#006FE3]" />
            <span>{statusMessage}</span>
          </div>
          <span className="text-[10px] opacity-75">Synced in real-time</span>
        </div>
      )}

      {/* 3 Clean Admin KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Users */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-all hover:shadow-card-hover ${
          theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200/90 shadow-card-premium'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span className="font-heading tracking-wider uppercase text-[10px]">TOTAL USERS</span>
            <div className="w-7 h-7 rounded-lg bg-[#006FE3]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#006FE3] flex-shrink-0" />
            </div>
          </div>
          <div className={`text-3xl font-black font-heading tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
            {users.length}
          </div>
          <div className="text-[11px] font-mono font-bold text-[#006FE3]">
            1 Admin &bull; {users.length - 1} Standard User{users.length - 1 === 1 ? '' : 's'}
          </div>
        </div>

        {/* Active Logged-In Sessions */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-all hover:shadow-card-hover ${
          theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200/90 shadow-card-premium'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span className="font-heading tracking-wider uppercase text-[10px]">AUTHENTICATED SESSIONS</span>
            <div className="w-7 h-7 rounded-lg bg-[#299346]/10 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-[#299346] flex-shrink-0" />
            </div>
          </div>
          <div className="text-3xl font-black font-heading text-[#299346] flex items-center gap-2 tracking-tight">
            <span>{activeSessionsCount}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#299346] animate-pulse"></span>
          </div>
          <div className="text-[11px] font-mono font-bold text-slate-500">
            {activeSessionsCount} active sessions verified
          </div>
        </div>

        {/* Total Scans Conducted */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-all hover:shadow-card-hover ${
          theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200/90 shadow-card-premium'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span className="font-heading tracking-wider uppercase text-[10px]">COMPLETED SCANS</span>
            <div className="w-7 h-7 rounded-lg bg-[#B9623C]/10 flex items-center justify-center">
              <History className="w-4 h-4 text-[#B9623C] flex-shrink-0" />
            </div>
          </div>
          <div className={`text-3xl font-black font-heading tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
            {safeScanHistory.length}
          </div>
          <div className="text-[11px] font-mono font-bold text-[#B9623C]">
            Audited &amp; saved in Supabase
          </div>
        </div>
      </div>

      {/* SECTION 1: Users & Permissions Table */}
      <div className={`p-6 rounded-2xl border space-y-4 transition-colors shadow-card-premium ${
        theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200/90'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 ${
          theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-100'
        }`}>
          <div>
            <h3 className={`text-base font-bold font-heading flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
              <Users className="w-4 h-4 text-[#006FE3]" />
              <span>User Directory &amp; Security Permissions Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">
              Click any user row to view findings discovered by that user. Click permission pills to toggle access.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user or role..."
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl font-mono text-xs border focus:outline-none transition-all ${
                theme === 'dark'
                  ? 'bg-[#001127] border-[#0A3778] text-white focus:border-[#006FE3]'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#006FE3]'
              }`}
            />
          </div>
        </div>

        {/* Clean Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-mono font-bold uppercase tracking-wider ${
                theme === 'dark' ? 'border-[#0A3778] text-slate-400' : 'border-slate-100 text-slate-500'
              }`}>
                <th className="py-3 px-4 font-heading">User</th>
                <th className="py-3 px-3 font-heading">Role</th>
                <th className="py-3 px-3 font-heading">Status</th>
                <th className="py-3 px-3 font-heading">Security</th>
                <th className="py-3 px-3 font-heading">Scans</th>
                <th className="py-3 px-4 font-heading">Assigned Permissions (Click to Toggle)</th>
                <th className="py-3 px-4 text-right font-heading">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-xs ${theme === 'dark' ? 'divide-[#0A3778]/60' : 'divide-slate-100'}`}>
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin';
                const userScansList = safeScanHistory.filter(s => {
                  if (!s || !user) return false;
                  const uName = (user.username || '').toLowerCase();
                  const uId = (user.id || '').toLowerCase();
                  const createdBy = (s.createdBy || '').toLowerCase();
                  const scannedBy = (s.scannedBy || '').toLowerCase();
                  return createdBy === uName || createdBy === uId || scannedBy === uName || scannedBy === uId;
                });
                const isSelected = selectedUserId === user.id;

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? (theme === 'dark' ? 'bg-[#006FE3]/15 border-l-4 border-l-[#006FE3]' : 'bg-[#E6F1FC]/70 border-l-4 border-l-[#006FE3]')
                        : theme === 'dark'
                        ? 'hover:bg-[#002354]/50'
                        : 'hover:bg-slate-50/80'
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    {/* User */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isAdmin ? 'bg-[#006FE3]/15 text-[#006FE3]' : 'bg-[#299346]/15 text-[#299346]'
                        }`}>
                          {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className={`font-heading font-bold ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                            {user.username}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        isAdmin
                          ? 'bg-[#006FE3]/15 text-[#006FE3] border-[#006FE3]/30'
                          : 'bg-[#299346]/15 text-[#299346] border-[#299346]/30'
                      }`}>
                        {isAdmin ? 'ADMIN' : 'USER'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 font-mono">
                      {user.isOnline ? (
                        <span className="flex items-center gap-1.5 text-[#299346] font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-[#299346] animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Offline</span>
                      )}
                    </td>

                    {/* Security Status */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                        theme === 'dark' 
                          ? 'bg-[#001127] border-[#0A3778] text-[#4D9AEC]' 
                          : 'bg-slate-100 border-slate-200 text-[#006FE3]'
                      }`}>
                        <Shield className="w-3 h-3 text-[#299346]" />
                        <span>Encrypted</span>
                      </span>
                    </td>

                    {/* Scans */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className="font-bold text-[#006FE3]">{userScansList.length}</span>
                      <span className="text-slate-400 text-[11px]"> scans</span>
                    </td>

                    {/* Compact Permissions Pills */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                        {ALL_PERMISSIONS.map((perm) => {
                          const isGranted = isAdmin ? true : Boolean(user.permissions?.[perm.id]);

                          return (
                            <button
                              key={perm.id}
                              type="button"
                              onClick={() => !isAdmin && handleTogglePermission(user.id, perm.id)}
                              disabled={isAdmin}
                              title={perm.description}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all border ${
                                isAdmin
                                  ? 'bg-[#006FE3]/10 text-[#006FE3] border-[#006FE3]/25 cursor-default opacity-85'
                                  : isGranted
                                  ? 'bg-[#299346]/15 text-[#299346] border-[#299346]/30 hover:bg-[#DC2626]/20 hover:text-[#DC2626] hover:border-[#DC2626]/40 cursor-pointer'
                                  : theme === 'dark'
                                  ? 'bg-[#001127] text-slate-400 border-[#0A3778] hover:bg-[#299346]/20 hover:text-[#299346] hover:border-[#299346]/40 cursor-pointer'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-[#299346]/15 hover:text-[#299346] hover:border-[#299346]/30 cursor-pointer'
                              }`}
                            >
                              {perm.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedUserId(user.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold font-heading flex items-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#006FE3] text-white shadow-sm'
                              : theme === 'dark'
                              ? 'bg-[#001127] text-slate-300 hover:bg-[#006FE3] hover:text-white border border-[#0A3778]'
                              : 'bg-slate-100 text-slate-700 hover:bg-[#006FE3] hover:text-white border border-slate-200'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Findings</span>
                        </button>

                        {!isAdmin && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Selected User's Security Scans & Findings Audit */}
      <div className={`p-6 rounded-2xl border space-y-6 transition-colors shadow-card-premium ${
        theme === 'dark' ? 'bg-[#001B41] border-[#0A3778]' : 'bg-white border-slate-200/90'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
          theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-100'
        }`}>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[#006FE3] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-heading">
                <ShieldCheck className="w-4 h-4 text-[#006FE3]" />
                <span>Auditing Findings for:</span>
              </span>
              <span className="text-base font-bold font-heading px-2.5 py-0.5 rounded bg-[#006FE3]/15 text-[#006FE3] border border-[#006FE3]/25">
                {selectedUser?.username} ({selectedUser?.role?.toUpperCase()})
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans">
              {selectedUserScans.length} total scan{selectedUserScans.length === 1 ? '' : 's'} recorded for this user account.
            </p>
          </div>

          <div className="text-xs font-mono text-[#299346] font-bold flex items-center gap-1.5 font-heading">
            <span className="w-2 h-2 rounded-full bg-[#299346]"></span>
            <span>Real-time Live Sync</span>
          </div>
        </div>

        {selectedUserScans.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2 font-mono text-xs">
            <Activity className="w-8 h-8 opacity-40 mx-auto text-[#006FE3]" />
            <div className="font-heading font-bold text-sm text-slate-700 dark:text-slate-300">No scans recorded for @{selectedUser?.username} yet.</div>
            <div className="text-[11px] text-slate-500">When this user launches an autonomous penetration test, all results and findings will appear here automatically.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedUserScans.map((scan) => {
              const findings = sortVulnerabilities(scan.vulnerabilities || []);
              const highList = findings.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL');
              const medList = findings.filter(v => v.severity === 'MEDIUM');

              return (
                <div
                  key={scan.id}
                  className={`p-5 rounded-2xl border space-y-4 transition-all ${
                    theme === 'dark'
                      ? 'bg-[#001127] border-[#0A3778] hover:border-[#006FE3]'
                      : 'bg-slate-50/70 border-slate-200 hover:border-[#006FE3]'
                  }`}
                >
                  {/* Scan Header */}
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
                    theme === 'dark' ? 'border-[#0A3778]/80' : 'border-slate-200'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          scan.riskLevel === 'HIGH' || scan.riskLevel === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                            : 'bg-[#B9623C]/15 text-[#B9623C] border-[#B9623C]/30'
                        }`}>
                          {scan.riskLevel} RISK
                        </span>
                        <h4 className={`text-sm font-bold font-heading ${theme === 'dark' ? 'text-white' : 'text-[#001B41]'}`}>
                          {scan.companyName}
                        </h4>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs font-mono text-[#006FE3]">{scan.targetUrl}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500">
                        <span>Scan ID: <strong className="text-slate-700 dark:text-slate-300">{scan.id}</strong></span>
                        <span>&bull;</span>
                        <span>Date: <strong className="text-slate-700 dark:text-slate-300">{scan.timestamp?.slice(0, 16)}</strong></span>
                        <span>&bull;</span>
                        <span>Duration: <strong className="text-slate-700 dark:text-slate-300">{scan.duration || '38 min'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => onSelectScan(scan)}
                        className="px-4 py-2 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-bold text-xs font-heading transition-all flex items-center gap-1.5 shadow-md shadow-[#006FE3]/25 cursor-pointer active:scale-[0.98]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect in Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Findings Discovered in this Scan */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Confirmed Vulnerability Findings ({findings.length}):</span>
                      <span className="text-slate-400 font-normal">
                        {highList.length} High &bull; {medList.length} Medium
                      </span>
                    </div>

                    {findings.length === 0 ? (
                      <div className="text-xs font-mono text-slate-400 py-2">
                        No vulnerabilities discovered during this scan.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {findings.map((vuln) => (
                          <div
                            key={vuln.id}
                            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                              theme === 'dark' ? 'bg-[#000E20] border-[#0A3778]' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  vuln.severity === 'CRITICAL'
                                    ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30 font-black'
                                    : vuln.severity === 'HIGH'
                                    ? 'bg-orange-500/15 text-orange-600 border border-orange-500/30 font-extrabold'
                                    : vuln.severity === 'MEDIUM'
                                    ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 font-bold'
                                    : 'bg-sky-500/15 text-sky-600 border border-sky-500/30'
                                }`}>
                                  {vuln.severity} ({vuln.cvss})
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 truncate">{vuln.cwe}</span>
                              </div>

                              <h5 className={`text-xs font-bold font-heading leading-tight truncate ${
                                theme === 'dark' ? 'text-slate-200' : 'text-[#001B41]'
                              }`}>
                                {vuln.title}
                              </h5>

                              <div className="text-[10px] font-mono text-[#006FE3] truncate">
                                {vuln.endpoint || vuln.target}
                              </div>
                            </div>

                            <button
                              onClick={() => onSelectScan(scan)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#006FE3] hover:bg-[#006FE3]/10 transition-colors flex-shrink-0 cursor-pointer"
                              title="Inspect Finding in Dashboard"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 transition-colors ${
            theme === 'dark' ? 'bg-[#001B41] border-[#0A3778] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3.5 ${
              theme === 'dark' ? 'border-[#0A3778]' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-2 font-bold text-base font-heading text-[#001B41] dark:text-white">
                <div className="w-7 h-7 rounded-lg bg-[#006FE3]/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#006FE3]" />
                </div>
                <span>Create New User Account</span>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#002B66] text-lg font-bold cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 uppercase font-heading">Username</label>
                <input
                  type="text"
                  required
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  placeholder="e.g. analyst1"
                  className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs border transition-all ${
                    theme === 'dark' 
                      ? 'border-[#0A3778] bg-[#001127] text-white focus:outline-none focus:border-[#006FE3]' 
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#006FE3] focus:bg-white'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 uppercase font-heading">Email (Optional)</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="e.g. analyst@sennovate.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs border transition-all ${
                    theme === 'dark' 
                      ? 'border-[#0A3778] bg-[#001127] text-white focus:outline-none focus:border-[#006FE3]' 
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#006FE3] focus:bg-white'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 uppercase font-heading">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="text-[11px] font-mono text-[#006FE3] hover:text-[#4D9AEC] flex items-center gap-1 cursor-pointer font-bold"
                  >
                    {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showNewUserPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? "text" : "password"}
                    required
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Enter secure password"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl font-mono text-xs border transition-all ${
                      theme === 'dark' 
                        ? 'border-[#0A3778] bg-[#001127] text-white focus:outline-none focus:border-[#006FE3]' 
                        : 'border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#006FE3] focus:bg-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-[#006FE3] cursor-pointer"
                  >
                    {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 uppercase font-heading">Role</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl font-mono text-xs border transition-all cursor-pointer ${
                    theme === 'dark' 
                      ? 'border-[#0A3778] bg-[#001127] text-white focus:outline-none focus:border-[#006FE3]' 
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:border-[#006FE3] focus:bg-white'
                  }`}
                >
                  <option value="user">Standard User (Client Safe View)</option>
                  <option value="admin">Administrator (Full System Access)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-heading font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#006FE3] hover:bg-[#005bbd] text-white font-bold text-xs font-heading transition-all cursor-pointer shadow-md shadow-[#006FE3]/25 active:scale-[0.98]"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
