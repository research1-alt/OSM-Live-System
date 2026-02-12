
import React, { useState } from 'react';
import { authService, User, ALLOWED_DOMAIN, SPREADSHEET_ID } from '../services/authService.ts';
import { otpService } from '../services/otpService.ts';
import { hashPassword, generateSessionId } from '../utils/crypto.ts';
import { ShieldCheck, Lock, Mail, Smartphone, User as UserIcon, Loader2, ArrowRight, ShieldAlert, KeyRound, Fingerprint, RefreshCcw, CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: User, sessionId: string) => void;
}

type AuthMode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');
  const [sourceMode, setSourceMode] = useState<AuthMode>('login');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = email.toLowerCase().trim();

    try {
      if (mode === 'login') {
        const hashedPassword = await hashPassword(password);
        const cloudUser = await authService.fetchUserFromCloud(normalizedEmail);
        
        if (cloudUser && cloudUser.success && cloudUser.user.password === hashedPassword) {
          const sid = generateSessionId();
          await authService.syncSessionToCloud(cloudUser.user.email, cloudUser.user.userName, sid);
          onAuthenticated(cloudUser.user, sid);
        } else {
          const localUsers = JSON.parse(localStorage.getItem('osm_users') || '[]');
          const localUser = localUsers.find((u: any) => u.email === normalizedEmail && u.password === hashedPassword);
          
          if (localUser) {
            const sid = generateSessionId();
            await authService.syncSessionToCloud(localUser.email, localUser.userName, sid);
            onAuthenticated(localUser, sid);
          } else {
            setError('Access Denied: Invalid operator credentials.');
          }
        }
      } else if (mode === 'signup' || mode === 'forgot') {
        if (!normalizedEmail.endsWith(ALLOWED_DOMAIN)) {
          setError(`Access Limited: Use ${ALLOWED_DOMAIN}`);
          setLoading(false);
          return;
        }

        if (mode === 'signup' && password !== confirmPassword) {
          setError('Mismatch: Passwords do not match.');
          setLoading(false);
          return;
        }

        // Check if user exists for forgot password
        if (mode === 'forgot') {
          const cloudUser = await authService.fetchUserFromCloud(normalizedEmail);
          if (!cloudUser || !cloudUser.success) {
            setError('User record not found in central registry.');
            setLoading(false);
            return;
          }
          setUserName(cloudUser.user.userName);
          setMobile(cloudUser.user.mobile);
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(otp);
        setSourceMode(mode);

        await otpService.dispatchOtp(normalizedEmail, otp, mode === 'forgot' ? 'Operator' : userName, mode === 'forgot' ? 'N/A' : mobile);
        setMode('verify');
      } else if (mode === 'verify') {
        if (userOtpInput === generatedOtp) {
          if (sourceMode === 'forgot') {
            setMode('reset');
            setPassword('');
            setConfirmPassword('');
          } else if (sourceMode === 'signup') {
            // Commit user for signup
            const hashedPassword = await hashPassword(password);
            const newUser = { email: normalizedEmail, userName, mobile, password: hashedPassword };
            await authService.registerUserInCloud(newUser);
            
            const localUsers = JSON.parse(localStorage.getItem('osm_users') || '[]');
            localUsers.push(newUser);
            localStorage.setItem('osm_users', JSON.stringify(localUsers));
            
            alert('REGISTRATION_COMPLETE: Access Authorized. Please log in.');
            setMode('login');
          }
        } else {
          setError('Mismatch: Invalid Access Code.');
        }
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          setError('Mismatch: Passwords do not match.');
          setLoading(false);
          return;
        }

        const hashedPassword = await hashPassword(password);
        const updatedUser = { email: normalizedEmail, userName, mobile, password: hashedPassword };
        
        await authService.registerUserInCloud(updatedUser);
        
        const localUsers = JSON.parse(localStorage.getItem('osm_users') || '[]');
        const existingIdx = localUsers.findIndex((u: any) => u.email === normalizedEmail);
        if (existingIdx > -1) {
          localUsers[existingIdx] = updatedUser;
        } else {
          localUsers.push(updatedUser);
        }
        localStorage.setItem('osm_users', JSON.stringify(localUsers));
        
        alert('SUCCESS: Credentials updated. Proceeding to Login.');
        setMode('login');
        resetFields();
      }
    } catch (err: any) {
      setError(`Signal Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFields = () => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setUserOtpInput('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5 flex flex-wrap gap-20 p-20">
         {Array.from({length: 12}).map((_, i) => <ShieldCheck key={i} size={120} />)}
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-12">
          <div className="inline-flex p-4 bg-indigo-600 text-white rounded-[24px] shadow-2xl mb-6 relative">
            {mode === 'verify' ? <KeyRound size={40} /> : <Fingerprint size={40} />}
            {loading && <div className="absolute -inset-2 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
          </div>
          <h1 className="text-4xl font-orbitron font-black text-slate-900 uppercase tracking-tighter">OSM <span className="text-indigo-600">Secure</span></h1>
        </div>

        <form onSubmit={handleAuth} className="glass-panel p-8 rounded-[40px] border border-slate-200 shadow-2xl transition-all relative">
          <div className="space-y-4">
            {/* EMAIL FIELD */}
            {(mode !== 'verify' && mode !== 'reset') && (
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" placeholder="Registered Email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[12px] font-bold tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                />
              </div>
            )}

            {/* SIGNUP EXTRA FIELDS */}
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="Full Name" value={userName} onChange={e => setUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[12px] font-bold tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                  />
                </div>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="Mobile Number" value={mobile} onChange={e => setMobile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[12px] font-bold tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                  />
                </div>
              </>
            )}
            
            {/* PASSWORD FIELDS */}
            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder={mode === 'reset' ? "New Password" : "Password"} 
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-12 rounded-2xl text-[12px] font-bold tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <div className="relative">
                <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-12 rounded-2xl text-[12px] font-bold tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {/* OTP VERIFICATION */}
            {mode === 'verify' && (
              <div className="py-2 text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-widest">Enter 4-Digit Security Code</p>
                <div className="relative inline-block w-48">
                  <input 
                    type="text" maxLength={4} placeholder="0000" 
                    value={userOtpInput} 
                    onChange={e => setUserOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 py-5 px-4 rounded-2xl text-4xl font-orbitron font-black tracking-[0.5em] focus:ring-2 ring-indigo-500/20 outline-none text-center" 
                    required 
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={14} />
                  <p className="text-red-600 text-[9px] font-black uppercase">Technical Fault</p>
                </div>
                <p className="text-red-500 text-[9px] font-mono break-words leading-tight">{error}</p>
            </div>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full mt-8 py-5 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 
             mode === 'login' ? 'LOGIN' : 
             mode === 'signup' ? 'DISPATCH OTP' : 
             mode === 'forgot' ? 'REQUEST RESET' :
             mode === 'reset' ? 'UPDATE PASSWORD' : 'Verify Registry'}
            <ArrowRight size={18} />
          </button>

          <div className="flex flex-col gap-2 mt-6">
            <button 
              type="button" onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                resetFields();
              }}
              className="w-full text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw size={12} />
              {mode === 'login' ? 'Register New Operator' : 'Return to Authorized Access'}
            </button>

            {mode === 'login' && (
              <button 
                type="button" onClick={() => {
                  setMode('forgot');
                  resetFields();
                }}
                className="w-full text-[10px] text-indigo-500 font-bold uppercase tracking-[0.2em] hover:text-indigo-700 transition-colors flex items-center justify-center gap-2 mt-2"
              >
                Forgot Password?
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
