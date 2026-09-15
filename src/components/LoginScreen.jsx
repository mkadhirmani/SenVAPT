import React, { useState } from 'react';
import Logo from './Logo';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Shield,
  Search,
  FileText 
} from 'lucide-react';
import { authenticateUser, fetchGlobalUsersList } from '../utils/auth';
import { initSupabaseBrowserConfig } from '../utils/supabaseClient';

export default function LoginScreen({ onLoginSuccess, theme = 'light' }) {
  const [selectedRole, setSelectedRole] = useState('user');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync Supabase config and users on login screen mount
  React.useEffect(() => {
    initSupabaseBrowserConfig().catch(() => {});
    fetchGlobalUsersList().catch(() => {});
  }, []);

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* Left Panel: Sennovate Corporate Blue Brand & Capabilities */}
      <div className="lg:w-1/2 w-full bg-[#001B41] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative">
        {/* Top: Logo & System Title */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Logo theme="dark" size="lg" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-[#006FE3]"></span>
            <span>Autonomous VAPT Platform &bull; Enterprise Console</span>
          </div>
        </div>

        {/* Middle: Formal Enterprise Capability Highlights */}
        <div className="my-10 lg:my-0 space-y-6 max-w-xl">
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-white tracking-tight leading-tight">
              Autonomous Vulnerability Assessment &amp; Penetration Testing
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Enterprise cybersecurity platform designed to continuously assess web applications, identify perimeter vulnerabilities, and validate security controls under OWASP WSTG v4.2 standards.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#80B7F1]">
                <Search className="w-3.5 h-3.5" />
              </div>
              <div>
                <strong className="text-white font-semibold block text-sm">Automated Attack Surface Reconnaissance</strong>
                <span className="text-slate-300 text-xs leading-relaxed">Continuous mapping of target endpoints, APIs, and perimeter assets.</span>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#80B7F1]">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <strong className="text-white font-semibold block text-sm">Deterministic Exploit Verification</strong>
                <span className="text-slate-300 text-xs leading-relaxed">Zero false-positive proof-of-concept validation for confirmed findings.</span>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#80B7F1]">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <strong className="text-white font-semibold block text-sm">Executive &amp; Technical Audit Reports</strong>
                <span className="text-slate-300 text-xs leading-relaxed">Comprehensive downloadable PDF deliverable reports with tailored remediation plans.</span>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-xs text-slate-200">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-[#80B7F1]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <strong className="text-white font-semibold block text-sm">Role-Based Identity Governance</strong>
                <span className="text-slate-300 text-xs leading-relaxed">Granular permission controls and data isolation across teams and auditors.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Formal Copyright & Compliance Notice */}
        <div className="pt-6 border-t border-white/10 text-xs text-slate-400 space-y-1">
          <div>&copy; {new Date().getFullYear()} Sennovate Inc. All rights reserved.</div>
          <div className="text-[11px] text-slate-500">
            Confidential &amp; Proprietary &bull; OWASP WSTG v4.2 &bull; NIST SP 800-115
          </div>
        </div>
      </div>

      {/* Right Panel: Formal Credentials Form */}
      <div className="lg:w-1/2 w-full bg-slate-50 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-sm space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-heading font-bold text-slate-900">
              Sign In
            </h2>
            <p className="text-xs text-slate-500">
              Enter your corporate credentials to access the VAPT command center.
            </p>
          </div>

          {/* Role Switcher Tabs */}
          <div className="p-1 rounded-lg border border-slate-200 bg-slate-100 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => handleRoleSelect('user')}
              className={`py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'user'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Analyst Login</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSelect('admin')}
              className={`py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Username or Corporate Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or user@sennovate.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#006FE3] focus:border-[#006FE3]"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#006FE3] focus:border-[#006FE3]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#006FE3] hover:bg-[#005bbd] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Assurance */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>TLS 1.3 Encrypted</span>
            </span>
            <span>Sennovate Security Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
