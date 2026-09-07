import React, { useState } from 'react';
import Logo from './Logo';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Key, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Radar,
  Shield,
  Sparkles,
  Database,
  Settings,
  X
} from 'lucide-react';
import { authenticateUser, fetchGlobalUsersList } from '../utils/auth';
import { supabase, getActiveSupabaseConfig, initSupabaseBrowserConfig } from '../utils/supabaseClient';

export default function LoginScreen({ onLoginSuccess, theme = 'dark' }) {
  const [selectedRole, setSelectedRole] = useState('user');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState({
    checked: false,
    connected: false,
    usersLoaded: 0,
    projectId: '',
    error: null
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configUrl, setConfigUrl] = useState('');
  const [configKey, setConfigKey] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');

  const checkSupabase = React.useCallback(async () => {
    await initSupabaseBrowserConfig().catch(() => {});
    const { url } = getActiveSupabaseConfig();
    let projectId = '';
    try {
      if (url) {
        const u = new URL(url);
        projectId = u.hostname.split('.')[0];
      }
    } catch (_) {}

    try {
      const { data, error: qErr } = await supabase.from('vapt_users').select('id, username, role');
      if (!qErr && Array.isArray(data)) {
        setDbStatus({
          checked: true,
          connected: true,
          usersLoaded: data.length,
          projectId: projectId || 'supabase',
          error: null
        });
      } else {
        setDbStatus({
          checked: true,
          connected: false,
          usersLoaded: 0,
          projectId: projectId || '',
          error: qErr?.message || 'Unable to query vapt_users'
        });
      }
    } catch (err) {
      setDbStatus({
        checked: true,
        connected: false,
        usersLoaded: 0,
        projectId: projectId || '',
        error: err.message
      });
    }
    fetchGlobalUsersList().catch(() => {});
  }, []);

  // Sync users and verify live Supabase connection on mount
  React.useEffect(() => {
    checkSupabase();
  }, [checkSupabase]);

  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    if (!configUrl.trim() || !configKey.trim()) {
      setConfigError('Please enter both Supabase Project URL and Anon/Publishable Key.');
      return;
    }
    setConfigError('');
    setConfigLoading(true);
    try {
      const res = await fetch('/api/supabase/init-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: configUrl.trim(), key: configKey.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      if (typeof window !== 'undefined') {
        window.__SUPABASE_CONFIG__ = { url: configUrl.trim(), key: configKey.trim() };
      }
      await checkSupabase();
      setConfigLoading(false);
      setShowConfigModal(false);
    } catch (err) {
      setConfigLoading(false);
      setConfigError(err.message || 'Failed to connect to Supabase');
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both your username and password.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      // Sync fresh users from backend file store
      await fetchGlobalUsersList().catch(() => {});
      const user = await authenticateUser(username, password, selectedRole);
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 transition-colors duration-300 relative overflow-hidden ${
      theme === 'dark' ? 'bg-[#040811] text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Login Card */}
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl relative z-10 p-7 sm:p-9 space-y-6 transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#090F1E]/95 border-slate-800/90 backdrop-blur-xl shadow-cyan-950/20' 
          : 'bg-white border-slate-200 shadow-xl shadow-slate-200'
      }`}>
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo theme={theme} size="lg" />
          </div>
          <div className="space-y-1">
            <h2 className={`text-xl font-extrabold tracking-tight ${
              theme === 'dark' ? 'text-white' : 'text-slate-950'
            }`}>
              Autonomous VAPT Security Portal
            </h2>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Sign in to access your security assessment dashboard
            </p>
          </div>
        </div>

        {/* Role Switcher Tabs (User First, Admin Second) */}
        <div className={`p-1.5 rounded-2xl border grid grid-cols-2 gap-1.5 ${
          theme === 'dark' ? 'bg-[#060B16] border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => handleRoleSelect('user')}
            className={`py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedRole === 'user'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : theme === 'dark'
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>User Login</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleSelect('admin')}
            className={`py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              selectedRole === 'admin'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : theme === 'dark'
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Login</span>
          </button>
        </div>

        {/* Supabase Live Cloud Status Badge */}
        <div className={`p-2.5 px-3 rounded-xl border text-[11px] font-mono flex items-center justify-between transition-all ${
          dbStatus.connected 
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 shadow-sm'
            : dbStatus.checked && (!dbStatus.projectId || dbStatus.error)
            ? 'bg-amber-950/30 border-amber-500/30 text-amber-400'
            : 'bg-slate-900/40 border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              dbStatus.connected ? 'bg-emerald-400 animate-pulse' : dbStatus.checked ? 'bg-amber-400' : 'bg-cyan-400'
            }`}></span>
            <span className="truncate">
              {dbStatus.connected 
                ? `Supabase: Connected (${dbStatus.projectId})` 
                : dbStatus.checked && !dbStatus.projectId
                ? 'Supabase: Not Configured on Server'
                : dbStatus.checked && dbStatus.error
                ? 'Supabase: Connecting...'
                : 'Connecting to Supabase...'}
            </span>
          </div>
          {dbStatus.connected ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold whitespace-nowrap">
              {dbStatus.usersLoaded} users in vapt_users
            </span>
          ) : (
            <button
              type="button"
              onClick={() => { setShowConfigModal(true); setConfigError(''); }}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <Settings className="w-3 h-3" />
              <span>Connect Cloud</span>
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-1">
              <span className="font-bold block">{error}</span>
              {error.toLowerCase().includes('password') && (
                <span className="text-[11px] text-rose-300/90 block leading-tight">
                  Hint: Passwords must match the record in your Supabase table (<code className="bg-rose-950/50 px-1 py-0.5 rounded text-rose-200">vapt_users</code>). You can verify or edit passwords anytime in your Supabase Table Editor.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-mono font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username or email"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl font-mono text-sm border focus:outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-[#080E1C] border-slate-700 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                }`}
                autoFocus
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-mono font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={`w-full pl-10 pr-11 py-2.5 rounded-xl font-mono text-sm border focus:outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-[#080E1C] border-slate-700 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Supabase Dynamic Cloud Authentication Info */}
          <div className={`p-3 rounded-xl border text-[11px] font-mono space-y-1.5 transition-colors ${
            theme === 'dark' ? 'bg-[#060B16] border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Database className="w-3.5 h-3.5" />
                <span>Supabase Live Auth</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Table: vapt_users</span>
            </div>
            <div className="text-[10.5px] leading-relaxed text-slate-400">
              Users & roles are fetched live from your Supabase cloud table. Passwords can be viewed or changed directly in your Supabase Table Editor.
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm font-sans flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In as {selectedRole === 'admin' ? 'Administrator' : 'User'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="pt-2 text-center text-[11px] font-mono text-slate-500 flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>OWASP WSTG v4.2 Security Console</span>
        </div>

      </div>

      {/* Supabase Cloud Connection Modal (for Cloud Deployment Setup) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#090F1E] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm">Connect Supabase Cloud Database</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Provide your Supabase Project URL and Anon/Publishable Key. This configures the server (<code className="text-cyan-400">senvapt.sennovate.ai</code>) to connect directly to your <code className="text-cyan-400">vapt_users</code> and <code className="text-cyan-400">vapt_scans</code> tables.
            </p>

            {configError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{configError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5 font-mono text-xs">
                <label className="block text-slate-300 font-bold uppercase tracking-wider">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={configUrl}
                  onChange={(e) => setConfigUrl(e.target.value)}
                  placeholder="https://xgbpnwetwawnihfmngmq.supabase.co"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-[#060B16] border-slate-700 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <label className="block text-slate-300 font-bold uppercase tracking-wider">
                  Supabase Anon / Publishable Key
                </label>
                <input
                  type="password"
                  value={configKey}
                  onChange={(e) => setConfigKey(e.target.value)}
                  placeholder="sb_publishable_... or eyJhbGciOi..."
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-[#060B16] border-slate-700 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={configLoading}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {configLoading ? 'Connecting...' : 'Connect to Supabase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
