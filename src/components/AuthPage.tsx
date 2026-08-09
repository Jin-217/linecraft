import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  syncUserProfile 
} from '../firebase';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ShieldCheck,
  LineChart,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot password modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setGoogleLoading(true);
    try {
      const { isNewUser } = await signInWithGoogle();
      if (isNewUser) {
        setSuccessMsg("Welcome to Linecraft! Account created successfully.");
      } else {
        setSuccessMsg("Signed in successfully!");
      }
      setTimeout(() => {
        onSuccess();
      }, 600);
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google Sign In was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked by browser. Please allow popups for this site.');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Create Account
        const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(res.user, {
          displayName: displayName.trim()
        });
        const { isNewUser } = await syncUserProfile(res.user);
        setSuccessMsg('Account created successfully! Redirecting...');
        setTimeout(() => onSuccess(), 800);
      } else {
        // Sign In
        const res = await signInWithEmailAndPassword(auth, email.trim(), password);
        await syncUserProfile(res.user);
        setSuccessMsg('Signed in successfully! Redirecting...');
        setTimeout(() => onSuccess(), 800);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let friendlyMsg = 'Authentication failed. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMsg = 'Invalid email or password. Please try again or create an account.';
      } else if (err.code === 'auth/wrong-password') {
        friendlyMsg = 'Incorrect password.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMsg = 'An account with this email address already exists. Try signing in.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = 'Please enter a valid email address.';
      } else if (err.message) {
        friendlyMsg = err.message;
      }
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotStatus({ type: 'error', msg: 'Please enter your email address.' });
      return;
    }

    setForgotLoading(true);
    setForgotStatus(null);

    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      setForgotStatus({ 
        type: 'success', 
        msg: 'Password reset link sent! Check your email inbox.' 
      });
    } catch (err: any) {
      setForgotStatus({ 
        type: 'error', 
        msg: err.message || 'Failed to send password reset email.' 
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#090b17] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Background Animated Coordinate Grid & Glowing Sine Waves */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="auth-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(99, 102, 241, 0.12)" strokeWidth="1" />
              <path d="M 30 0 L 30 60 M 0 30 L 60 30" fill="none" stroke="rgba(99, 102, 241, 0.05)" strokeWidth="0.5" strokeDasharray="2 2" />
            </pattern>
            <linearGradient id="sine-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sine-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
              <stop offset="50%" stopColor="#ec4899" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />

          {/* Animating Glowing Sine Wave 1 */}
          <motion.path
            d="M -100 250 Q 200 100, 500 250 T 1100 250 T 1700 250"
            fill="none"
            stroke="url(#sine-grad-1)"
            strokeWidth="3"
            filter="drop-shadow(0px 0px 8px rgba(99,102,241,0.6))"
            animate={{
              d: [
                "M -100 250 Q 200 100, 500 250 T 1100 250 T 1700 250",
                "M -100 250 Q 200 400, 500 250 T 1100 250 T 1700 250",
                "M -100 250 Q 200 100, 500 250 T 1100 250 T 1700 250"
              ]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Animating Glowing Cosine Wave 2 */}
          <motion.path
            d="M -100 500 Q 300 650, 700 500 T 1500 500 T 2100 500"
            fill="none"
            stroke="url(#sine-grad-2)"
            strokeWidth="2.5"
            filter="drop-shadow(0px 0px 8px rgba(168,85,247,0.5))"
            animate={{
              d: [
                "M -100 500 Q 300 650, 700 500 T 1500 500 T 2100 500",
                "M -100 500 Q 300 350, 700 500 T 1500 500 T 2100 500",
                "M -100 500 Q 300 650, 700 500 T 1500 500 T 2100 500"
              ]
            }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </svg>
      </div>

      {/* Floating Inward Mathematical Symbols & Equations (3D Depth Perspective) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 [perspective:1000px]">
        {[
          { label: "f(x) = x² - 4x + 7", left: "8%", top: "12%", duration: 8, delay: 0, color: "text-indigo-300/40" },
          { label: "∫₀^∞ e^{-x²} dx = √π/2", left: "78%", top: "18%", duration: 10, delay: 0.5, color: "text-purple-300/40" },
          { label: "e^{iπ} + 1 = 0", left: "14%", top: "72%", duration: 9, delay: 1.2, color: "text-blue-300/40" },
          { label: "lim_{x→0} (sin x)/x = 1", left: "82%", top: "68%", duration: 11, delay: 2.0, color: "text-cyan-300/40" },
          { label: "d/dx [tan x] = sec² x", left: "4%", top: "42%", duration: 12, delay: 0.8, color: "text-indigo-400/35" },
          { label: "∇ × E = -∂B/∂t", left: "72%", top: "42%", duration: 9.5, delay: 1.8, color: "text-purple-400/35" },
          { label: "∑_{k=1}^n k³ = (n(n+1)/2)²", left: "22%", top: "86%", duration: 10.5, delay: 2.5, color: "text-blue-400/35" },
          { label: "r = a(1 - cos θ)", left: "68%", top: "82%", duration: 11.5, delay: 0.3, color: "text-cyan-400/35" },
          { label: "π ≈ 3.14159265", left: "28%", top: "8%", duration: 8.5, delay: 1.0, color: "text-indigo-300/40" },
          { label: "y = e^{-x} sin(2x)", left: "58%", top: "10%", duration: 12.5, delay: 2.2, color: "text-purple-300/40" },
          { label: "‖v‖ = √(x² + y² + z²)", left: "2%", top: "78%", duration: 9.2, delay: 3.1, color: "text-blue-300/40" },
          { label: "f'(x) = lim_{h→0} Δy/Δx", left: "88%", top: "32%", duration: 10.2, delay: 0.2, color: "text-cyan-300/40" },
          { label: "A = π r²", left: "42%", top: "5%", duration: 7.8, delay: 0.4, color: "text-indigo-300/35" },
          { label: "a² + b² = c²", left: "92%", top: "8%", duration: 8.8, delay: 1.6, color: "text-purple-300/35" },
          { label: "∇ · B = 0", left: "50%", top: "92%", duration: 9.8, delay: 2.8, color: "text-blue-300/35" },
          { label: "∫ (1/x) dx = ln|x| + C", left: "35%", top: "82%", duration: 11.2, delay: 3.6, color: "text-cyan-300/35" },
          { label: "z = r(cos θ + i sin θ)", left: "12%", top: "28%", duration: 10.0, delay: 0.9, color: "text-indigo-400/40" },
          { label: "det(A - λI) = 0", left: "84%", top: "26%", duration: 12.0, delay: 1.7, color: "text-purple-400/40" },
          { label: "d²y/dx² + ω²y = 0", left: "6%", top: "58%", duration: 9.0, delay: 2.3, color: "text-blue-400/40" },
          { label: "F = G (m₁m₂)/r²", left: "76%", top: "56%", duration: 8.2, delay: 3.2, color: "text-cyan-400/40" },
          { label: "E = mc²", left: "48%", top: "18%", duration: 7.2, delay: 1.4, color: "text-indigo-300/45" },
          { label: "iℏ ∂Ψ/∂t = ĤΨ", left: "18%", top: "62%", duration: 10.8, delay: 2.1, color: "text-purple-300/45" },
          { label: "sinh(x) = (e^x - e^{-x})/2", left: "64%", top: "74%", duration: 11.8, delay: 0.6, color: "text-blue-300/45" },
          { label: "P(A|B) = P(B|A)P(A)/P(B)", left: "30%", top: "22%", duration: 12.2, delay: 3.8, color: "text-cyan-300/45" },
          { label: "x = (-b ± √(b²-4ac))/2a", left: "2%", top: "90%", duration: 13.0, delay: 1.1, color: "text-indigo-400/35" },
          { label: "Γ(n) = (n-1)!", left: "86%", top: "88%", duration: 8.6, delay: 2.4, color: "text-purple-400/35" },
          { label: "∇² f = ∂²f/∂x² + ∂²f/∂y²", left: "20%", top: "48%", duration: 10.4, delay: 3.0, color: "text-blue-400/35" },
          { label: "∮ F · dr = ∬ (∇ × F) · dS", left: "60%", top: "48%", duration: 11.4, delay: 0.7, color: "text-cyan-400/35" },
          { label: "ζ(2) = π²/6", left: "38%", top: "76%", duration: 9.4, delay: 1.9, color: "text-indigo-300/40" },
          { label: "cos² θ + sin² θ = 1", left: "66%", top: "20%", duration: 8.4, delay: 2.7, color: "text-purple-300/40" },
          { label: "T = 2π √(L/g)", left: "10%", top: "2%", duration: 7.6, delay: 3.4, color: "text-blue-300/40" },
          { label: "V = (4/3) π r³", left: "80%", top: "3%", duration: 8.9, delay: 0.1, color: "text-cyan-300/40" },
          { label: "log_b(xy) = log_b(x) + log_b(y)", left: "40%", top: "94%", duration: 12.4, delay: 1.3, color: "text-indigo-400/35" },
          { label: "S = -k_B ∑ p_i ln p_i", left: "82%", top: "94%", duration: 10.6, delay: 2.9, color: "text-purple-400/35" },
          { label: "d/dx [arcsin x] = 1/√(1-x²)", left: "1%", top: "20%", duration: 11.6, delay: 3.7, color: "text-blue-400/35" },
          { label: "f(x) = ∑ (f^{(n)}(a)/n!)(x-a)^n", left: "55%", top: "28%", duration: 13.2, delay: 0.5, color: "text-cyan-400/35" },
          { label: "(x-h)² + (y-k)² = r²", left: "26%", top: "36%", duration: 9.6, delay: 1.5, color: "text-indigo-300/40" },
          { label: "∇ f = (∂f/∂x, ∂f/∂y)", left: "70%", top: "36%", duration: 8.7, delay: 2.6, color: "text-purple-300/40" },
          { label: "x = r cos θ, y = r sin θ", left: "15%", top: "80%", duration: 10.1, delay: 3.3, color: "text-blue-300/40" },
          { label: "[A, B] = AB - BA", left: "75%", top: "80%", duration: 7.9, delay: 0.8, color: "text-cyan-300/40" },
          { label: "∫ u dv = uv - ∫ v du", left: "44%", top: "42%", duration: 11.1, delay: 2.2, color: "text-indigo-400/40" },
          { label: "H(X) = -∑ P(x) log₂ P(x)", left: "32%", top: "66%", duration: 12.1, delay: 3.9, color: "text-purple-400/40" },
          { label: "f(x,y) = e^{-(x²+y²)}", left: "52%", top: "62%", duration: 9.3, delay: 1.0, color: "text-blue-400/40" },
          { label: "d/dx [a^x] = a^x ln a", left: "8%", top: "34%", duration: 8.3, delay: 2.0, color: "text-cyan-400/40" },
          { label: "J_0(x) = ∑ (-1)^k / (k!)² (x/2)^{2k}", left: "85%", top: "50%", duration: 13.5, delay: 0.4, color: "text-indigo-300/35" },
          { label: "y - y₁ = m(x - x₁)", left: "18%", top: "16%", duration: 7.7, delay: 1.8, color: "text-purple-300/35" },
          { label: "c = λ ν", left: "62%", top: "4%", duration: 8.1, delay: 2.7, color: "text-blue-300/35" },
          { label: "dx/dt = f(x, t)", left: "94%", top: "16%", duration: 9.1, delay: 3.5, color: "text-cyan-300/35" },
          { label: "M = ∬_D ρ(x,y) dA", left: "5%", top: "68%", duration: 10.3, delay: 0.2, color: "text-indigo-400/40" },
          { label: "φ = (1 + √5)/2 ≈ 1.618", left: "52%", top: "84%", duration: 11.3, delay: 1.4, color: "text-purple-400/40" },
          { label: "λ₁v₁ + λ₂v₂ = 0", left: "34%", top: "52%", duration: 8.7, delay: 2.5, color: "text-blue-400/40" },
          { label: "∂u/∂t = α ∂²u/∂x²", left: "62%", top: "90%", duration: 10.7, delay: 3.1, color: "text-cyan-400/40" },
          { label: "∂²u/∂t² = c² ∂²u/∂x²", left: "24%", top: "60%", duration: 11.7, delay: 0.9, color: "text-indigo-300/40" },
          { label: "F_n = F_{n-1} + F_{n-2}", left: "92%", top: "62%", duration: 9.7, delay: 1.6, color: "text-purple-300/40" },
          { label: "cosh² x - sinh² x = 1", left: "14%", top: "96%", duration: 10.9, delay: 2.8, color: "text-blue-300/40" },
          { label: "A^T A = I", left: "68%", top: "96%", duration: 8.0, delay: 3.6, color: "text-cyan-300/40" },
          { label: "Tr(AB) = Tr(BA)", left: "4%", top: "84%", duration: 9.2, delay: 0.7, color: "text-indigo-400/35" },
          { label: "∫₀¹ x^a (1-x)^b dx = B(a+1,b+1)", left: "46%", top: "14%", duration: 12.8, delay: 1.9, color: "text-purple-400/35" },
          { label: "lim_{n→∞} (1 + 1/n)^n = e", left: "74%", top: "14%", duration: 10.2, delay: 2.8, color: "text-blue-400/35" },
          { label: "ds² = -c²dt² + dx² + dy² + dz²", left: "28%", top: "44%", duration: 11.9, delay: 3.4, color: "text-cyan-400/35" },
          { label: "∇ × ∇f = 0", left: "88%", top: "42%", duration: 7.4, delay: 0.5, color: "text-indigo-300/40" },
          { label: "∇ · (∇ × A) = 0", left: "36%", top: "28%", duration: 8.4, delay: 1.7, color: "text-purple-300/40" },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            className={`absolute font-mono font-bold text-[11px] sm:text-xs tracking-widest whitespace-nowrap drop-shadow-[0_0_10px_rgba(99,102,241,0.35)] ${item.color}`}
            style={{ left: item.left, top: item.top }}
            initial={{ opacity: 0, scale: 0.15, z: -400 }}
            animate={{
              opacity: [0, 0.35, 0.65, 0],
              scale: [0.15, 0.9, 1.8, 2.3],
              y: [-10, -35, -60],
              rotate: [-4, 4, -1],
            }}
            transition={{
              duration: item.duration,
              repeat: Infinity,
              delay: item.delay,
              ease: "easeOut"
            }}
          >
            {item.label}
          </motion.div>
        ))}
      </div>

      {/* Main Glass Card */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-[#0f1222]/90 border border-slate-800/80 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 overflow-hidden"
      >
        {/* Subtle top gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center p-2.5 shadow-lg shadow-indigo-500/20">
              <img src="icon.svg" alt="Linecraft Logo" className="w-full h-full object-contain filter drop-shadow" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                linecraft
              </h1>
              <div className="flex flex-col">
                <span className="text-xs text-slate-300 font-medium tracking-wide">
                  advanced function visualizer created by ALI AMINI
                </span>
                <a 
                  href="mailto:alibertendless999.ko@gmail.com"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono font-semibold text-indigo-300 hover:text-indigo-200 transition-colors mt-0.5"
                >
                  <Mail size={16} className="shrink-0 text-indigo-400" />
                  <span>alibertendless999.ko@gmail.com</span>
                </a>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            {isSignUp 
              ? 'Create a secure account to save functions, track analytical graphs, and sync work.'
              : 'Sign in to access your linecraft visualizer environment and saved functions.'}
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Sign Up) */}
        <div className="grid grid-cols-2 p-1 bg-[#161a2e] border border-slate-800 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              !isSignUp 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              isSignUp 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error / Success Notifications */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300"
            >
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300"
            >
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full bg-[#181d36] hover:bg-[#202747] active:scale-[0.98] border border-slate-700/80 text-slate-100 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-3 transition-all shadow-md group disabled:opacity-50 disabled:cursor-not-allowed mb-5"
        >
          {googleLoading ? (
            <Loader2 size={16} className="animate-spin text-indigo-400" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#0f1222] px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500 absolute">
            or email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {/* Full Name Field (Sign Up Only) */}
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <UserIcon size={15} className="absolute left-3 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required={isSignUp}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full bg-[#161a2e] border border-slate-800 focus:border-indigo-500/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail size={15} className="absolute left-3 text-slate-500 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#161a2e] border border-slate-800 focus:border-indigo-500/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setIsForgotOpen(true);
                  }}
                  className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-3 text-slate-500 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#161a2e] border border-slate-800 focus:border-indigo-500/80 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Security & Terms note */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 text-center">
          <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
          <span>Encrypted authentication powered by Google Firebase</span>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {isForgotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0f1222] border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Mail size={16} className="text-indigo-400" />
                  Reset Your Password
                </h3>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Enter your registered email address and we'll send you a password reset link.
              </p>

              {forgotStatus && (
                <div className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                  forgotStatus.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {forgotStatus.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{forgotStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#161a2e] border border-slate-800 focus:border-indigo-500/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {forgotLoading ? <Loader2 size={15} className="animate-spin" /> : 'Send Reset Link'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
