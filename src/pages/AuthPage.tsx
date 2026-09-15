import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Role } from '../lib/supabase';
import {
  PHeading,
  PText,
  PButton,
  PInputText,
  PInputEmail,
  PInputPassword,
  PSelect,
  PSelectOption,
  PInlineNotification,
  PPinCode,
} from '@porsche-design-system/components-react';

type Step = 'login' | 'register' | 'forgot' | 'otp' | 'new_password';

export default function AuthPage() {
  const { refreshProfile, setResetFlow } = useAuth();
  const [step, setStep] = useState<Step>('login');

  // shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // register-only fields
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState<Role>('shop_owner');

  // forgot / otp / reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // countdown for resend
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startResendCountdown() {
    setResendCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function switchStep(next: Step) {
    setStep(next);
    setError('');
    setSuccessMsg('');
    if (next === 'login' || next === 'register') {
      setResetFlow(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setMobile('');
    }
    if (next === 'forgot') {
      setResetFlow(true);
      setResetEmail('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  // ── Login ──────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // ── Register ───────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          mobile,
          role,
        },
      },
    });
    if (signUpErr) {
      setError(signUpErr.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setStep('login');
      setSuccessMsg('Account created. Check your email to confirm your account, then sign in to finish setup.');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileErr } = await supabase.rpc('create_user_profile', {
        p_role: role,
        p_full_name: fullName,
        p_mobile: mobile,
      });
      if (profileErr) {
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      if (role === 'rider') {
        await supabase.from('riders').insert({ id: data.user.id });
      } else if (role === 'shop_owner') {
        await supabase.from('shops').insert({ owner_id: data.user.id, name: fullName + "'s Shop", address: '' });
      }

      await refreshProfile(data.user.id);
    }

    setLoading(false);
  }

  // ── Forgot — send OTP ──────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.signInWithOtp({
      email: resetEmail,
      options: { shouldCreateUser: false },
    });

    if (err) {
      setError(err.message);
    } else {
      setStep('otp');
      startResendCountdown();
    }
    setLoading(false);
  }

  // ── OTP — verify ──────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.verifyOtp({
      email: resetEmail,
      token: otp,
      type: 'email',
    });

    if (err) {
      setError('Invalid or expired code. Please try again.');
    } else {
      // verifyOtp signs the user in. resetFlow keeps App.tsx from redirecting.
      setStep('new_password');
    }
    setLoading(false);
  }

  // ── Resend OTP ────────────────────────────────────────────
  async function handleResend() {
    if (resendCountdown > 0) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: resetEmail,
      options: { shouldCreateUser: false },
    });
    if (err) setError(err.message);
    else startResendCountdown();
    setLoading(false);
  }

  // ── New password ──────────────────────────────────────────
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.updateUser({ password: newPassword });

    if (err) {
      setError(err.message);
    } else {
      setSuccessMsg('Password updated successfully.');
      setResetFlow(false);
      // App.tsx will now redirect to the dashboard on next render.
    }
    setLoading(false);
  }

  // ── Step metadata ─────────────────────────────────────────
  const stepTitles: Record<Step, string> = {
    login: 'Sign in to your account',
    register: 'Create your account',
    forgot: 'Reset your password',
    otp: 'Enter verification code',
    new_password: 'Set a new password',
  };

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-fluid-md">
      <div
        className="w-full max-w-md bg-surface rounded-[16px] p-fluid-md"
        style={{ boxShadow: '0px 8px 40px rgba(0,0,0,.12)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#006FFF' }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <PHeading size="medium" tag="h1">QuickDrop</PHeading>
        </div>

        {/* Back arrow for sub-steps */}
        {(step === 'forgot' || step === 'otp') && (
          <button
            type="button"
            onClick={() => switchStep(step === 'forgot' ? 'login' : 'forgot')}
            className="flex items-center gap-1 mb-4 text-[#006FFF] text-sm font-medium"
          >
            ← Back
          </button>
        )}

        <PText className="mb-5 text-contrast-medium">{stepTitles[step]}</PText>

        {error && (
          <div className="mb-4">
            <PInlineNotification state="error" heading="Error" description={error} dismissButton onDismiss={() => setError('')} />
          </div>
        )}
        {successMsg && (
          <div className="mb-4">
            <PInlineNotification state="success" heading="Success" description={successMsg} dismissButton={false} />
          </div>
        )}

        {/* ── LOGIN ─────────────────────────── */}
        {step === 'login' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 rounded-md border border-[#8b8f94] bg-white text-[#1d1d1f] font-semibold flex items-center justify-center gap-3 transition hover:bg-[#f5f6f7] disabled:opacity-60"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.26-.2-1.82H12v3.45h5.36a4.58 4.58 0 0 1-1.99 3.01v2.51h3.22c1.89-1.74 2.76-4.3 2.76-7.15Z"/>
                <path fill="#34A853" d="M12 21.6c2.7 0 4.96-.89 6.61-2.42l-3.22-2.51c-.89.6-2.03.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.59A9.99 9.99 0 0 0 12 21.6Z"/>
                <path fill="#FBBC05" d="M6.39 13.5a6.02 6.02 0 0 1 0-3.01V7.9H3.06a10 10 0 0 0 0 8.19l3.33-2.59Z"/>
                <path fill="#EA4335" d="M12 6.36c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.96 3.4 14.7 2.4 12 2.4a9.99 9.99 0 0 0-8.94 5.5l3.33 2.59C7.18 8.12 9.39 6.36 12 6.36Z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-[#d5d8dc]" />
              <PText size="small" className="text-contrast-medium">or use email</PText>
              <div className="h-px flex-1 bg-[#d5d8dc]" />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <PInputEmail
              name="email"
              label="Email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
            <div>
              <PInputPassword
                name="password"
                label="Password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              />
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={() => switchStep('forgot')}
                  className="text-[#006FFF] text-sm font-medium underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>
            <PButton type="submit" loading={loading} disabled={loading}>Sign In</PButton>
            <div className="text-center">
              <PText size="small" className="text-contrast-medium">
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => switchStep('register')} className="text-[#006FFF] font-semibold underline">
                  Register
                </button>
              </PText>
            </div>
            </form>
          </>
        )}

        {/* ── REGISTER ──────────────────────── */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <PInputText
              name="full_name"
              label="Full Name"
              value={fullName}
              onInput={(e) => setFullName((e.target as HTMLInputElement).value)}
            />
            <PInputText
              name="mobile"
              label="Mobile Number"
              value={mobile}
              onInput={(e) => setMobile((e.target as HTMLInputElement).value)}
            />
            <PSelect name="role" label="I am a" value={role} onUpdate={(e) => setRole(e.detail.value as Role)}>
              <PSelectOption value="shop_owner">Shop Owner</PSelectOption>
              <PSelectOption value="rider">Delivery Rider</PSelectOption>
            </PSelect>
            <PInputEmail
              name="email"
              label="Email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
            <PInputPassword
              name="password"
              label="Password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
            <PButton type="submit" loading={loading} disabled={loading}>Create Account</PButton>
            <div className="text-center">
              <PText size="small" className="text-contrast-medium">
                Already have an account?{' '}
                <button type="button" onClick={() => switchStep('login')} className="text-[#006FFF] font-semibold underline">
                  Sign In
                </button>
              </PText>
            </div>
          </form>
        )}

        {/* ── FORGOT — enter email ───────────── */}
        {step === 'forgot' && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <PText size="small" className="text-contrast-medium">
              Enter your registered email address and we will send you a 6-digit verification code.
            </PText>
            <PInputEmail
              name="reset_email"
              label="Email Address"
              value={resetEmail}
              onInput={(e) => setResetEmail((e.target as HTMLInputElement).value)}
            />
            <PButton type="submit" loading={loading} disabled={loading || !resetEmail}>
              Send Verification Code
            </PButton>
          </form>
        )}

        {/* ── OTP — enter code ──────────────── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
            <div className="rounded-[12px] p-3 text-center" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <PText size="small">Code sent to</PText>
              <PText weight="semi-bold">{resetEmail}</PText>
            </div>

            <div className="flex flex-col items-center gap-2">
              <PText size="small" className="text-contrast-medium">Enter the 6-digit code</PText>
              <PPinCode
                length={6}
                value={otp}
                onUpdate={(e) => setOtp(e.detail.value)}
              />
            </div>

            <PButton type="submit" loading={loading} disabled={loading || otp.length !== 6}>
              Verify Code
            </PButton>

            <div className="text-center">
              {resendCountdown > 0 ? (
                <PText size="small" className="text-contrast-medium">
                  Resend code in {resendCountdown}s
                </PText>
              ) : (
                <PText size="small" className="text-contrast-medium">
                  Didn&apos;t receive it?{' '}
                  <button type="button" onClick={handleResend} className="text-[#006FFF] font-semibold underline">
                    Resend code
                  </button>
                </PText>
              )}
            </div>
          </form>
        )}

        {/* ── NEW PASSWORD ───────────────────── */}
        {step === 'new_password' && !successMsg && (
          <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
            <PText size="small" className="text-contrast-medium">
              Choose a strong password for your account.
            </PText>
            <PInputPassword
              name="new_password"
              label="New Password"
              value={newPassword}
              onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
            />
            <PInputPassword
              name="confirm_password"
              label="Confirm Password"
              value={confirmPassword}
              onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
            />
            <PButton type="submit" loading={loading} disabled={loading || !newPassword || !confirmPassword}>
              Set New Password
            </PButton>
          </form>
        )}

        {/* ── PASSWORD SET SUCCESS ───────────── */}
        {step === 'new_password' && successMsg && (
          <div className="flex flex-col gap-4">
            <PText size="small" className="text-contrast-medium">
              Your password has been changed. You can now sign in with your new password.
            </PText>
            <PButton onClick={() => switchStep('login')}>
              Continue to Login
            </PButton>
          </div>
        )}
      </div>
    </div>
  );
}
