import React, { useState } from 'react';
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
  updateUserPermissions, 
  createNewUser, 
  deleteUser,
  updateUserPassword,
  ALL_PERMISSIONS, 
  getActiveSessionCount 
} from '../utils/auth';

export default function AdminUserManagement({ 
  currentUser, 
  scanHistory = [], 
  onSelectScan, 
  theme = 'dark' 
}) {
  const [users, setUsers] = useState(() => getUsersList());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('user');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(true);
  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [showPasswordChangeVal, setShowPasswordChangeVal] = useState(true);
  const [statusMessage, setStatusMessage] = useState(null);

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

  const handleTogglePermission = (userId, permId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    
    if (userId === 'admin' && permId === 'manage_users') {
      showFeedback('Cannot revoke Root Administrator privileges');
      return;
    }

    const currentVal = Boolean(targetUser.permissions?.[permId]);
    const updatedUsers = updateUserPermissions(userId, { [permId]: !currentVal });
    setUsers(updatedUsers);
    showFeedback(`Permission '${permId}' updated for ${targetUser.username}`);
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password) {
      showFeedback('Username and password are required');
      return;
    }

    try {
      const updated = createNewUser({
        username: newUserData.username,
        name: newUserData.role === 'admin' ? 'Administrator' : newUserData.username,
        email: newUserData.email || `${newUserData.username}@sennovate.com`,
        password: newUserData.password,
        role: newUserData.role,
        title: newUserData.role === 'admin' ? 'Administrator' : 'Standard User'
      });
      setUsers(updated);
      setIsAddUserOpen(false);
      setNewUserData({ username: '', email: '', password: '', role: 'user' });
      showFeedback(`User ${newUserData.username} created successfully!`);
    } catch (err) {
      showFeedback(err.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = (userId) => {
    if (window.confirm('Are you sure you want to remove this user account?')) {
      try {
        const updated = deleteUser(userId);
        setUsers(updated);
        if (selectedUserId === userId) {
          setSelectedUserId('admin');
        }
        showFeedback('User account removed');
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
  const selectedUserScans = safeScanHistory.filter(s => 
    s && (s.scannedBy === selectedUserId || (selectedUserId === 'user' && !s.scannedBy))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className={`p-6 sm:p-7 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm transition-colors ${
        theme === 'dark' 
          ? 'bg-gradient-to-r from-[#0E162B] via-[#0A1121] to-[#0E162B] border-slate-800' 
          : 'bg-gradient-to-r from-slate-50 via-white to-slate-50 border-slate-300'
      }`}>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-cyan-500 text-xs font-mono font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
            <span>Admin Portal &bull; User Access Control &amp; Audit</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            User Management &amp; Scan Findings Audit
          </h1>
          <p className={`text-xs sm:text-sm leading-relaxed max-w-3xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
            Manage users and permission matrices in real-time. Click any user in the table below to inspect their security findings and automated penetration testing activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          {/* Export System Backup Button */}
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/system/export-backup');
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
                }
              } catch (e) {
                showFeedback(`Backup Export Failed: ${e.message}`);
              }
            }}
            className={`flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-[#0E172B] hover:bg-[#152342] text-slate-300 border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title="Download full backup of all users, scans, and configurations"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Backup</span>
          </button>

          {/* Import / Restore System Backup Button */}
          <label className={`flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
            theme === 'dark' 
              ? 'bg-[#0E172B] hover:bg-[#152342] text-slate-300 border-slate-700' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
          }`}>
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Restore Backup</span>
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json)
                  });
                  if (res.ok) {
                    showFeedback('System Snapshot Restored! Refreshing data...');
                    setTimeout(() => window.location.reload(), 1200);
                  } else {
                    throw new Error('Import API failed');
                  }
                } catch (err) {
                  showFeedback(`Import Failed: ${err.message}`);
                }
              }}
            />
          </label>

          {/* Change Admin Password Button */}
          <button
            onClick={() => {
              const adminUser = users.find(u => u.username === 'admin') || users[0];
              setPasswordModalUser(adminUser);
              setNewPasswordValue('');
              setShowPasswordChangeVal(true);
            }}
            className={`flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-[#0E172B] hover:bg-[#152342] text-amber-300 border-amber-500/40 hover:border-amber-400' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
            title="Change Administrator Password"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Change Admin Password</span>
          </button>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold font-sans transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
          <span className="text-[10px] opacity-75">Updated in real-time</span>
        </div>
      )}

      {/* 3 Clean Admin KPI Cards (No AI Tokens) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Users */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>TOTAL USERS</span>
            <Users className="w-4 h-4 text-cyan-500 flex-shrink-0" />
          </div>
          <div className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {users.length}
          </div>
          <div className="text-[11px] font-mono font-bold text-cyan-400">
            1 Admin &bull; {users.length - 1} Standard User{users.length - 1 === 1 ? '' : 's'}
          </div>
        </div>

        {/* Active Logged-In Sessions */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>LOGGED IN USERS</span>
            <UserCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400 flex items-center gap-2">
            <span>{activeSessionsCount}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-[11px] font-mono font-bold text-slate-400">
            {activeSessionsCount} active sessions online
          </div>
        </div>

        {/* Total Scans Conducted */}
        <div className={`p-5 rounded-2xl border flex flex-col justify-between h-32 transition-colors ${
          theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between text-xs font-mono font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
          }`}>
            <span>AUDIT SCANS DONE</span>
            <History className="w-4 h-4 text-amber-500 flex-shrink-0" />
          </div>
          <div className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {safeScanHistory.length}
          </div>
          <div className="text-[11px] font-mono font-bold text-amber-400">
            Live and automatically synced
          </div>
        </div>
      </div>

      {/* SECTION 1: Users & Permissions Table */}
      <div className={`p-6 rounded-2xl border space-y-4 transition-colors ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              <Users className="w-4 h-4 text-cyan-500" />
              <span>User Directory &amp; Permissions Matrix Table</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
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
                  ? 'bg-[#080E1C] border-slate-700 text-white focus:border-cyan-400'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500'
              }`}
            />
          </div>
        </div>

        {/* Clean Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b text-[11px] font-mono font-bold uppercase tracking-wider ${
                theme === 'dark' ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
              }`}>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Scans</th>
                <th className="py-3 px-4">Assigned Permissions (Click to Toggle)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin';
                const userScansList = safeScanHistory.filter(s => s && (s.scannedBy === user.id || ((user.id === 'user' || user.id === 'user1') && !s.scannedBy)));
                const isSelected = selectedUserId === user.id;

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/10 border-l-4 border-l-cyan-500'
                        : theme === 'dark'
                        ? 'hover:bg-slate-900/60'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    {/* User */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${
                          isAdmin ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className={`font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
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
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isAdmin
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}>
                        {isAdmin ? 'ADMIN' : 'USER'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 font-mono">
                      {user.isOnline ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Offline</span>
                      )}
                    </td>

                    {/* Scans */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className="font-bold text-cyan-400">{userScansList.length}</span>
                      <span className="text-slate-500 text-[11px]"> scans</span>
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
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 cursor-default opacity-80'
                                  : isGranted
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 cursor-pointer'
                                  : 'bg-slate-800/40 text-slate-500 border-slate-700 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 cursor-pointer'
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
                          onClick={() => {
                            setPasswordModalUser(user);
                            setNewPasswordValue('');
                            setShowPasswordChangeVal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold font-sans flex items-center gap-1 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-all cursor-pointer"
                          title={`Change password for ${user.username}`}
                        >
                          <Key className="w-3 h-3 text-amber-400" />
                          <span>Password</span>
                        </button>

                        <button
                          onClick={() => setSelectedUserId(user.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 shadow-sm'
                              : 'bg-slate-800 text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Findings</span>
                        </button>

                        {!isAdmin && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
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
      <div className={`p-6 rounded-2xl border space-y-6 transition-colors ${
        theme === 'dark' ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Auditing Findings for:</span>
              </span>
              <span className={`text-base font-bold font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40`}>
                {selectedUser?.username} ({selectedUser?.role?.toUpperCase()})
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {selectedUserScans.length} total scan{selectedUserScans.length === 1 ? '' : 's'} recorded for this user account.
            </p>
          </div>

          <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Real-time Live Sync</span>
          </div>
        </div>

        {selectedUserScans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2 font-mono text-xs">
            <Activity className="w-8 h-8 opacity-40 mx-auto" />
            <div>No scans recorded for @{selectedUser?.username} yet.</div>
            <div className="text-[11px] text-slate-600">When this user launches an autonomous penetration test, all results and findings will appear here automatically.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedUserScans.map((scan) => {
              const findings = scan.vulnerabilities || [];
              const highList = findings.filter(v => v.severity === 'HIGH' || v.severity === 'CRITICAL');
              const medList = findings.filter(v => v.severity === 'MEDIUM');

              return (
                <div
                  key={scan.id}
                  className={`p-5 rounded-2xl border space-y-4 transition-all ${
                    theme === 'dark'
                      ? 'bg-[#080E1C] border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Scan Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          scan.riskLevel === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {scan.riskLevel} RISK
                        </span>
                        <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                          {scan.companyName}
                        </h4>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-xs font-mono text-cyan-400">{scan.targetUrl}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                        <span>Scan ID: <strong className="text-slate-300">{scan.id}</strong></span>
                        <span>&bull;</span>
                        <span>Date: <strong className="text-slate-300">{scan.timestamp?.slice(0, 16)}</strong></span>
                        <span>&bull;</span>
                        <span>Duration: <strong className="text-slate-300">{scan.duration || '38 min'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => onSelectScan(scan)}
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-sans transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect in Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Findings Discovered in this Scan */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Confirmed Vulnerability Findings ({findings.length}):</span>
                      <span className="text-slate-400 font-normal">
                        {highList.length} High &bull; {medList.length} Medium
                      </span>
                    </div>

                    {findings.length === 0 ? (
                      <div className="text-xs font-mono text-slate-500 py-2">
                        No vulnerabilities discovered during this scan.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {findings.map((vuln) => (
                          <div
                            key={vuln.id}
                            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                              theme === 'dark' ? 'bg-[#050914] border-slate-800/90' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  vuln.severity === 'HIGH' || vuln.severity === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {vuln.severity} ({vuln.cvss})
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 truncate">{vuln.cwe}</span>
                              </div>

                              <h5 className={`text-xs font-bold leading-tight truncate ${
                                theme === 'dark' ? 'text-slate-200' : 'text-slate-900'
                              }`}>
                                {vuln.title}
                              </h5>

                              <div className="text-[10px] font-mono text-cyan-400 truncate">
                                {vuln.endpoint || vuln.target}
                              </div>
                            </div>

                            <button
                              onClick={() => onSelectScan(scan)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors flex-shrink-0"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-5 transition-colors ${
            theme === 'dark' ? 'bg-[#0B1120] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-base">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Create New User Account</span>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase">Username</label>
                <input
                  type="text"
                  required
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  placeholder="e.g. user3"
                  className="w-full px-3 py-2 rounded-xl font-mono text-xs border border-slate-700 bg-[#080E1C] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase">Email (Optional)</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="e.g. user3@sennovate.com"
                  className="w-full px-3 py-2 rounded-xl font-mono text-xs border border-slate-700 bg-[#080E1C] text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-slate-300 uppercase">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
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
                    className="w-full pl-3 pr-10 py-2 rounded-xl font-mono text-xs border border-slate-700 bg-[#080E1C] text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-400 cursor-pointer"
                  >
                    {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase">Role</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl font-mono text-xs border border-slate-700 bg-[#080E1C] text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="user">Standard User (Client Safe View)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-sans transition-all cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
            theme === 'dark' ? 'bg-[#0A1121] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Change User Password</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Account: <strong className="text-cyan-400">{passwordModalUser.username}</strong> ({passwordModalUser.role})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newPasswordValue.trim()) {
                showFeedback('Please enter a new password.');
                return;
              }
              try {
                const updated = updateUserPassword(passwordModalUser.id, newPasswordValue.trim());
                setUsers(updated);
                showFeedback(`Password updated successfully for "${passwordModalUser.username}"!`);
                setPasswordModalUser(null);
                setNewPasswordValue('');
              } catch (err) {
                showFeedback(`Error: ${err.message}`);
              }
            }} className="p-6 space-y-4 font-sans text-xs">
              <div className="space-y-1.5">
                <label className="font-mono font-bold text-slate-400 uppercase text-[10px]">Target Account:</label>
                <input
                  type="text"
                  disabled
                  value={`${passwordModalUser.name || passwordModalUser.username} (${passwordModalUser.email})`}
                  className="w-full px-3.5 py-2.5 rounded-xl font-mono text-xs bg-slate-900/60 border border-slate-800 text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono font-bold text-slate-300 flex items-center justify-between text-[11px]">
                  <span>New Password:</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Visible (toggle with eye icon)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswordChangeVal ? 'text' : 'password'}
                    required
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    placeholder="Enter new password..."
                    autoFocus
                    className={`w-full px-3.5 py-2.5 pr-10 rounded-xl font-mono text-xs border focus:outline-none transition-all ${
                      theme === 'dark'
                        ? 'bg-[#080E1C] border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordChangeVal(!showPasswordChangeVal)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPasswordChangeVal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-cyan-400" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono leading-relaxed">
                <strong>Instant Effect:</strong> The new password is saved to local storage, synced to the backend server, and active immediately.
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-sans shadow-md cursor-pointer transition-all"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
