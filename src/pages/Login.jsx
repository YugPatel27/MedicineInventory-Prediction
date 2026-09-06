import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials } from '../store/slices/authSlice';
import { apiClient } from '../api/axios';
import { BrandMark } from '../components/BrandMark';
import Alert from '../components/Alert';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);

  useEffect(() => {
    document.title = 'Login — MediStock';
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      const authData = data?.data || {};
      dispatch(
        setCredentials({
          user: authData.user,
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
        })
      );
      navigate('/dashboard');
    } catch (err) {
      if (err?.response?.data?.message) setError(err.response.data.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setRegistering(true);
    try {
      const payload = { name: regName || (regEmail && regEmail.split('@')[0]), email: regEmail, password: regPassword };
      const { data } = await apiClient.post('/auth/register', payload);
      setError('');
      setRegSuccess(data?.message || 'Registered successfully');
      setRegName(''); setRegEmail(''); setRegPassword('');
      setTimeout(() => setRegSuccess(''), 5000);
    } catch (err) {
      if (err?.response?.data?.message) setError(err.response.data.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-3 py-6 sm:px-4 sm:py-10 overflow-hidden">
      {/* Local background keeps the login shell fast and available offline. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/forecast.png')",
        }}
      />
      {/* Green-tinted, dulled overlay so it stays subtle behind the card */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/80 via-emerald-800/70 to-white/90" />

      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-[2rem]">
        <div className="grid gap-5 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-500 px-5 py-7 text-white sm:grid-cols-[1.2fr_1fr] sm:gap-6 sm:px-8 sm:py-10">
          <div>
            <BrandMark theme="dark" />
            <h2 className="mt-5 text-2xl font-semibold sm:mt-6 sm:text-3xl">Welcome back</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/90">Sign in to access medicine inventory, forecasting, and expiry insights.</p>
          </div>
          <div className="hidden items-end justify-end sm:flex">
            <div className="rounded-2xl bg-black/15 p-4 text-sm leading-5 text-white/90">Local healthcare stack with fast inventory operations.</div>
          </div>
        </div>

        <div className="bg-white px-5 py-7 sm:px-10 sm:py-9">
          {error && <Alert type="danger">{error}</Alert>}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 border-t pt-6">
            {!showRegisterForm ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Don't have an account?</p>
                <button type="button" onClick={() => setShowRegisterForm(true)} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Create account</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Create account</h3>
                  <button type="button" onClick={() => setShowRegisterForm(false)} className="text-sm text-muted-foreground">Cancel</button>
                </div>
                {regSuccess && <div className="mt-3"><Alert type="success">{regSuccess}</Alert></div>}
                <form onSubmit={handleRegister} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Full name</label>
                    <input value={regName} onChange={(e) => setRegName(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Email address</label>
                    <input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} type="password" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none" />
                  </div>
                  <div className="flex gap-3">
                    <button disabled={registering} type="submit" className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">{registering ? 'Creating…' : 'Create account'}</button>
                    <button type="button" onClick={() => setShowRegisterForm(false)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="mt-6 text-sm text-slate-500">
            <p>Use demo accounts to log in quickly:</p>
            <p className="mt-2">Admin: admin@hospital.com / admin123</p>
            <p>User: user@hospital.com / user123</p>
          </div>
        </div>
      </div>
    </div>
  );
}