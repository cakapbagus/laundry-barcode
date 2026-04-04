import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useAppConfigStore } from '../stores/appConfigStore';

interface StageHistory {
  id: string;
  fromStage: string | null;
  toStage: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  operator: { id: string; name: string };
  notes: string | null;
}

interface OrderData {
  id: string;
  orderCode: string;
  customer: { nis: string; nama: string; kamar: string; kelas: string };
  status: string;
  statusLabel: string;
  createdAt: string;
  estimatedCompletion: string;
  completedAt: string | null;
  history: StageHistory[];
}

const STAGES = ['INTAKE', 'WASHING', 'DRYING', 'IRONING', 'PACKING', 'FINISHED', 'PICKED_UP'];

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Penerimaan',
  WASHING: 'Pencucian',
  DRYING: 'Pengeringan',
  IRONING: 'Penyetrikaan',
  PACKING: 'Pengepakan',
  FINISHED: 'Selesai / Siap Diambil',
  PICKED_UP: 'Sudah Diambil',
};

const STAGE_ICONS: Record<string, string> = {
  INTAKE: '📥',
  WASHING: '🧼',
  DRYING: '💨',
  IRONING: '👔',
  PACKING: '📦',
  FINISHED: '✅',
  PICKED_UP: '🏠',
};

const STAGE_LABELS_SHORT: Record<string, string> = {
  INTAKE: 'Terima',
  WASHING: 'Cuci',
  DRYING: 'Kering',
  IRONING: 'Setrika',
  PACKING: 'Kemas',
  FINISHED: 'Selesai',
  PICKED_UP: 'Diambil',
};


export default function PublicTrackPage() {
  const appTitle = useAppConfigStore((s) => s.title);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('order') || 'LAU-');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const orderParam = searchParams.get('order');
    if (orderParam) {
      setQuery(orderParam);
      fetchOrder(orderParam);
    }
  }, []);

  async function fetchOrder(code: string) {
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await apiClient.get(`/public/track/${encodeURIComponent(code.trim().toUpperCase())}`);
      setOrder(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Order tidak ditemukan. Periksa kembali kode order Anda.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    fetchOrder(query);
  }

  const currentStageIdx = order ? STAGES.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-2 sm:py-4 mobile-landscape:py-1 flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-gray-900 leading-tight">Lacak Cucian</h1>
            <p className="text-xs text-gray-500">{appTitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 sm:py-6 mobile-landscape:!py-2 mobile-landscape:max-w-full">
        {/* Search Box */}
        <form onSubmit={handleSearch} className="mb-3 sm:mb-6 mobile-landscape:mb-2">
          <label className="hidden sm:block mobile-landscape:!hidden text-sm font-medium text-gray-700 mb-2">
            Masukkan Kode Order
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field flex-1 font-mono uppercase"
              placeholder="Contoh: LAU-20260101-001"
              autoCapitalize="characters"
            />
            <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
              {loading ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : 'Lacak'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Order Result */}
        {order && (
          <div className="space-y-3 mobile-landscape:space-y-0">
            {/* Landscape: status + progress side by side */}
            <div className="space-y-3 mobile-landscape:space-y-0 mobile-landscape:flex mobile-landscape:gap-2 mobile-landscape:items-start">
            {/* Status Card */}
            <div className="card border-indigo-100 !p-3 sm:!p-5 mobile-landscape:!p-2 mobile-landscape:w-2/5 mobile-landscape:flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">{order.orderCode}</p>
                  <h2 className="text-base sm:text-xl font-bold text-gray-900 mt-0.5 mobile-landscape:text-sm">{order.customer?.nama}</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mobile-landscape:hidden">NIS: {order.customer?.nis} · {order.customer?.kamar} · {order.customer?.kelas}</p>
                </div>
                <div className="text-3xl sm:text-4xl mobile-landscape:text-2xl">{STAGE_ICONS[order.status] || '📦'}</div>
              </div>

              <div className="mt-2 sm:mt-4 mobile-landscape:mt-1.5 px-3 py-2 mobile-landscape:px-2 mobile-landscape:py-1 bg-indigo-50 rounded-lg flex items-center justify-between">
                <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mobile-landscape:hidden">Status</p>
                <p className="text-sm sm:text-base font-bold text-indigo-900 mobile-landscape:text-xs">{STAGE_LABELS[order.status] || order.status}</p>
              </div>

              {order.status === 'FINISHED' && (
                <div className="mt-2 mobile-landscape:mt-1 px-3 py-2 mobile-landscape:px-2 mobile-landscape:py-1 bg-green-50 rounded-lg text-xs text-green-700 font-medium text-center">
                  ✅ Siap diambil
                </div>
              )}

              {order.status !== 'PICKED_UP' && order.status !== 'FINISHED' && (
                <div className="mt-2 mobile-landscape:mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mobile-landscape:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>
                    Estimasi:{' '}
                    <strong>
                      {new Date(order.estimatedCompletion).toLocaleDateString('id-ID', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </strong>
                  </span>
                </div>
              )}

              {order.completedAt && order.status === 'PICKED_UP' && (
                <div className="mt-2 mobile-landscape:mt-1 px-3 py-2 mobile-landscape:px-2 mobile-landscape:py-1 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">
                    Diambil: <strong>{new Date(order.completedAt).toLocaleString('id-ID')}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Progress — horizontal stepper (mobile & desktop) */}
            <div className="card !p-3 sm:!p-5 mobile-landscape:!p-2 mobile-landscape:flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 mobile-landscape:mb-2">Progress Cucian</h3>
              <div className="flex">
                {STAGES.map((stage, idx) => {
                  const isTerminal = stage === 'FINISHED' || stage === 'PICKED_UP';
                  const isDone = idx < currentStageIdx || (idx === currentStageIdx && isTerminal);
                  const isCurrent = idx === currentStageIdx && !isTerminal;
                  const isLast = idx === STAGES.length - 1;
                  const histEntry = order.history?.find((h) => h.toStage === stage);

                  return (
                    <div key={stage} className="flex-1 flex flex-col items-center relative">
                      {/* Left connector */}
                      {idx > 0 && (
                        <div className={`absolute top-3 sm:top-4 left-0 right-1/2 h-0.5 ${
                          idx <= currentStageIdx ? 'bg-green-400' : 'bg-gray-200'
                        }`} />
                      )}
                      {/* Right connector */}
                      {!isLast && (
                        <div className={`absolute top-3 sm:top-4 left-1/2 right-0 h-0.5 ${
                          idx < currentStageIdx ? 'bg-green-400' : 'bg-gray-200'
                        }`} />
                      )}
                      {/* Dot */}
                      <div className={`relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0 ${
                        isDone ? 'bg-green-500 text-white' :
                        isCurrent ? 'bg-indigo-600 text-white ring-2 sm:ring-4 ring-indigo-100' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {isDone ? '✓' : STAGE_ICONS[stage]}
                      </div>
                      {/* Label */}
                      <p className={`text-[10px] sm:text-xs text-center mt-1 font-medium leading-tight px-0.5 ${
                        isDone ? 'text-green-700' :
                        isCurrent ? 'text-indigo-700' :
                        'text-gray-400'
                      }`}>
                        {STAGE_LABELS_SHORT[stage]}
                      </p>
                      {/* Timestamp — desktop only */}
                      {histEntry && (
                        <p className="hidden sm:block text-[10px] text-center text-gray-400 mt-0.5 leading-tight">
                          {new Date(histEntry.startedAt).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                      {/* Current pulse */}
                      {isCurrent && (
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-indigo-500 animate-pulse mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            </div>{/* end landscape flex wrapper */}

            {/* Info */}
            <div className="text-center text-xs text-gray-400 pb-2 mobile-landscape:py-2">
              Dibuat {new Date(order.createdAt).toLocaleString('id-ID')}
            </div>
          </div>
        )}

        {!order && !error && !loading && (
          <div className="text-center py-10 sm:py-12">
            <div className="text-5xl sm:text-6xl mb-3">🧺</div>
            <p className="text-xs sm:text-sm text-gray-500">Masukkan kode order untuk melacak status cucian Anda</p>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 pb-2 mobile-landscape:py-2">
          <a href="/login" className="text-indigo-500 hover:underline">Login Staff</a>
        </div>

      </div>
    </div>
  );
}
