import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAppConfigStore } from '../stores/appConfigStore';
import apiClient from '../api/client';


export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { title: appTitle, slogan: appSlogan } = useAppConfigStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function doLogin(loginName: string, loginPassword: string) {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/login', { name: loginName, password: loginPassword });
      const { token, user } = res.data;
      setAuth(token, user);
      if (user.role === 'KASIR') navigate('/intake');
      else if (user.role === 'OPERATOR') navigate('/scanner');
      else if (user.role === 'MANAGER') navigate('/dashboard');
      else if (user.role === 'MUSYRIF') navigate('/musyrif');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login gagal. Periksa nama dan password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    doLogin(name, password);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4
                    mobile-landscape:p-3 mobile-landscape:items-stretch">

      {/* Floating button → Track */}
      <button
        onClick={() => navigate('/track')}
        className="fixed top-6 left-6 flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-full shadow-lg transition-colors z-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <span className="hidden sm:inline">Lacak Cucian</span>
      </button>

      {/* Portrait: single column | mobile-landscape: 2 columns */}
      <div className="w-full max-w-md mobile-landscape:max-w-2xl mobile-landscape:flex mobile-landscape:gap-4 mobile-landscape:items-center">

        {/* ── LEFT: Branding ── */}
        <div className="text-center mb-8
                        mobile-landscape:mb-0 mobile-landscape:w-2/5 mobile-landscape:flex-shrink-0
                        mobile-landscape:flex mobile-landscape:flex-col mobile-landscape:items-center mobile-landscape:justify-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg mb-4
                          mobile-landscape:w-14 mobile-landscape:h-14 mobile-landscape:mb-3">
            <svg className="w-9 h-9 text-white mobile-landscape:w-8 mobile-landscape:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mobile-landscape:text-lg">{appTitle}</h1>
          <p className="text-gray-500 mt-1 mobile-landscape:text-xs">{appSlogan}</p>
          <p className="text-xs text-gray-400 mt-4 mobile-landscape:mt-3 hidden mobile-landscape:block">
            &copy; {new Date().getFullYear()}
          </p>
        </div>

        {/* ── RIGHT: Form ── */}
        <div className="mobile-landscape:flex-1 mobile-landscape:flex mobile-landscape:flex-col mobile-landscape:justify-center">

          {/* Login Card */}
          <div className="card mobile-landscape:p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 mobile-landscape:text-sm mobile-landscape:mb-2">Masuk ke Sistem</h2>

            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                </svg>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 mobile-landscape:space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 mobile-landscape:hidden">
                  Nama Pengguna
                </label>
                <input
                  type="text"
                  className="input-field mobile-landscape:py-1.5 mobile-landscape:text-sm"
                  placeholder="Nama pengguna..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 mobile-landscape:hidden">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field mobile-landscape:py-1.5 mobile-landscape:text-sm pr-10"
                    placeholder="Password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 mobile-landscape:py-1.5 mobile-landscape:text-sm"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Memuat...
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>
          </div>

          <div className="mt-3 p-1 lg:p-4 bg-green-50 border border-green-200 rounded-xl mobile-landscape:mt-2 mobile-landscape:p-2 text-center">
            <span className="text-xs lg:text-sm text-green-700 mb-2 px-2">
              Untuk demo, silakan hubungi kami →
            </span>
            <a
              href={`https://wa.me/6282170270241?text=${encodeURIComponent('Halo, saya tertarik dengan webapp Laundry Pesantren, saya ingin mencoba DEMO apakah bisa?')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6 mobile-landscape:hidden">
            {appTitle} &copy; {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>
  );
}
