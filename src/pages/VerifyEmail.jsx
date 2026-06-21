import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/axios';
import { BrandMark } from '../components/BrandMark';
import Alert from '../components/Alert';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Verify Email - MediStock';
  }, []);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/auth/verify-email', { token });
      setMessage(data?.message || 'Email verified successfully.');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="bg-gradient-to-r from-sky-700 via-sky-500 to-sky-400 px-8 py-10 text-white">
          <BrandMark />
          <h1 className="mt-6 text-3xl font-semibold">Verify your email</h1>
          <p className="mt-3 text-sm text-slate-200/80">
            Enter the verification token sent to your email to activate your account.
          </p>
        </div>

        <div className="px-8 py-9">
          {error && <Alert type="danger">{error}</Alert>}
          {message && <div className="mb-4"><Alert type="success">{message}</Alert></div>}

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Verification token</label>
              <input
                type="text"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Verifying...' : 'Verify email'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-4 text-sm font-medium text-sky-700 hover:text-sky-800"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
