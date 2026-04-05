import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';
import { useAppConfigStore } from '../stores/appConfigStore';

const STATUS_LABEL: Record<string, string> = {
  INTAKE: 'Diterima',
  WASHING: 'Dicuci',
  DRYING: 'Dikeringkan',
  IRONING: 'Disetrika',
  PACKING: 'Dikemas',
  FINISHED: 'Selesai',
  PICKED_UP: 'Diambil',
};

const STATUS_COLOR: Record<string, string> = {
  INTAKE: 'bg-blue-100 text-blue-700',
  WASHING: 'bg-cyan-100 text-cyan-700',
  DRYING: 'bg-yellow-100 text-yellow-700',
  IRONING: 'bg-orange-100 text-orange-700',
  PACKING: 'bg-purple-100 text-purple-700',
  FINISHED: 'bg-green-100 text-green-700',
  PICKED_UP: 'bg-gray-100 text-gray-500',
};

interface Order {
  id: string;
  orderCode: string;
  customer: { id: string; nis: string; nama: string; kamar: string; kelas: string };
  status: string;
  createdAt: string;
  qrCode: string;
  notes: string | null;
  createdBy?: { name: string };
}

interface Pagination {
  page: number;
  totalPages: number;
  total: number;
}

const PULL_THRESHOLD = 72;

function InfoModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-mono font-bold text-indigo-700 text-sm">{order.orderCode}</p>
            <p className="text-xs text-gray-500">{order.customer?.nama} · NIS: {order.customer?.nis}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Kamar</p><p className="font-medium">{order.customer?.kamar}</p></div>
            <div><p className="text-xs text-gray-500">Kelas</p><p className="font-medium">{order.customer?.kelas}</p></div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Catatan</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 min-h-[40px]">
              {order.notes || <span className="text-gray-400 italic">-</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { title: appTitle, slogan: appSlogan, paperWidth } = useAppConfigStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [infoOrder, setInfoOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pull-to-refresh state
  const [pullDelta, setPullDelta] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiClient.get(`/orders?${params}`);
      setOrders(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchOrders, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchOrders, search]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  async function handleConfirmDelete() {
    if (!deleteOrder) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/orders/${deleteOrder.id}`);
      setDeleteOrder(null);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menghapus order');
    } finally {
      setDeleting(false);
    }
  }

  // Pull-to-refresh handlers (mobile only)
  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!isPulling) return;
    const delta = Math.max(0, e.touches[0].clientY - touchStartY.current);
    setPullDelta(Math.min(delta, PULL_THRESHOLD * 1.5));
  }
  function handleTouchEnd() {
    if (pullDelta >= PULL_THRESHOLD) fetchOrders();
    setPullDelta(0);
    setIsPulling(false);
  }

  function handlePrint(order: Order) {
    const now = new Date(order.createdAt);
    const tglMasuk = now.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const trackUrl = `${window.location.origin}/track`;
    const existing = document.getElementById('__print_frame__');
    if (existing) existing.remove();
    const iframe = document.createElement('iframe');
    iframe.id = '__print_frame__';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Nota Laundry - ${order.orderCode}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: auto; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px; color: #000;
            padding: 3mm 4mm;
            ${/^\d+$/.test(paperWidth) ? `width:${paperWidth}mm;` : 'width:100%;'}
          }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
          .header h1 { font-size: 1.3em; font-weight: bold; letter-spacing: 1px; }
          .header p { font-size: 0.9em; }
          .order-code { text-align: center; font-size: 1.6em; font-weight: bold; letter-spacing: 2px; margin: 5px 0; padding: 4px; border: 2px solid #000; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 1em; gap: 4px; }
          .label { color: #444; white-space: nowrap; }
          .value { font-weight: bold; text-align: right; word-break: break-all; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .qr { text-align: center; margin: 6px 0; }
          .qr img { width: 55%; max-width: 110px; height: auto; }
          .qr-label { font-size: 0.85em; margin-bottom: 3px; }
          .track-url { text-align: center; font-size: 0.75em; word-break: break-all; margin-top: 3px; color: #333; }
          .footer { text-align: center; font-size: 0.8em; border-top: 2px dashed #000; padding-top: 5px; margin-top: 5px; }
          .reprint { text-align: center; font-size: 0.75em; color: #777; margin-bottom: 3px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${appTitle.toUpperCase()}</h1>
          <p>${appSlogan}</p>
        </div>
        <div class="reprint">*** CETAK ULANG ***</div>
        <div class="order-code">${order.orderCode}</div>
        <div class="row"><span class="label">Nama Santri</span><span class="value">${order.customer?.nama}</span></div>
        <div class="row"><span class="label">NIS</span><span class="value">${order.customer?.nis}</span></div>
        <div class="row"><span class="label">Kamar</span><span class="value">${order.customer?.kamar}</span></div>
        <div class="row"><span class="label">Kelas</span><span class="value">${order.customer?.kelas}</span></div>
        <div class="row"><span class="label">Tgl. Masuk</span><span class="value">${tglMasuk}</span></div>
        <div class="divider"></div>
        <div class="qr">
          <p class="qr-label">Scan QR untuk lacak cucian:</p>
          <img src="${order.qrCode}" alt="QR Code" />
          <p>atau</p>
          <p class="track-url">Buka situs: ${trackUrl}</p>
          <p class="track-url">Masukkan kode order: <b>${order.orderCode}</b></p>
        </div>
        <div class="footer"><p>Terima kasih atas kepercayaan Anda!</p></div>
        <script>
          (function() {
            var pw = '${paperWidth}';
            var isTherm = /^\\d+$/.test(pw);
            var namedSize = { A4:'A4', A5:'A5', F4:'210mm 330mm', LETTER:'letter' };
            function applyAndPrint() {
              var s = document.createElement('style');
              if (isTherm) {
                var h = document.body.scrollHeight;
                s.textContent = '@page{size:' + pw + 'mm ' + h + 'px;margin:0;}';
              } else {
                s.textContent = '@page{size:' + (namedSize[pw] || pw) + ';margin:10mm 15mm;}';
              }
              document.head.appendChild(s);
              window.print();
              window.onafterprint = function(){ try { window.frameElement.remove(); } catch(e){} };
            }
            var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
            var pending = imgs.filter(function(i){ return !i.complete; });
            if (pending.length === 0) { applyAndPrint(); }
            else {
              var done = 0;
              pending.forEach(function(i){
                i.onload = i.onerror = function(){ if (++done === pending.length) applyAndPrint(); };
              });
            }
          })();
        <\/script>
      </body>
      </html>
    `);
    doc.close();
  }

  const pulling = pullDelta > 0;
  const willRefresh = pullDelta >= PULL_THRESHOLD;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Pull indicator — mobile only, shown during pull gesture */}
      {pulling && (
        <div className="sm:hidden fixed top-14 inset-x-0 z-30 flex justify-center pointer-events-none">
          <div
            className={`mt-2 px-4 py-1.5 rounded-full text-xs font-medium shadow transition-colors ${
              willRefresh ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}
            style={{ transform: `scale(${0.85 + (pullDelta / PULL_THRESHOLD) * 0.15})` }}
          >
            {willRefresh ? '↑ Lepaskan untuk refresh' : '↓ Tarik untuk refresh'}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="max-w-5xl mx-auto px-4 py-3 lg:py-6 mobile-landscape:py-2 pb-nav"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={pulling ? { transform: `translateY(${pullDelta * 0.4}px)`, transition: 'none' } : { transition: 'transform 0.2s' }}
      >
        {/* Header */}
        <div className="mb-3 lg:mb-6 mobile-landscape:mb-2">
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Daftar Order</h1>
          <p className="hidden sm:block mobile-landscape:!hidden text-gray-500 mt-1">Seluruh order masuk</p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-2 lg:gap-3 mb-3 lg:mb-4 mobile-landscape:flex-row mobile-landscape:gap-1.5 mobile-landscape:mb-2">
          <input
            type="text"
            className="input-field flex-1 mobile-landscape:py-1.5 mobile-landscape:text-sm"
            placeholder="Ketik kode order atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input-field sm:w-44 mobile-landscape:py-1.5 mobile-landscape:text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {/* Refresh button — desktop only */}
          <button onClick={fetchOrders} className="btn-secondary whitespace-nowrap hidden sm:block">
            Refresh
          </button>
        </div>

        {/* Total */}
        <p className="text-xs lg:text-sm text-gray-500 mb-2 lg:mb-3 mobile-landscape:mb-1">
          {loading ? 'Memuat...' : `${pagination.total} order ditemukan`}
        </p>

        {/* Mobile: card list — Desktop: table */}
        <>
          {/* Mobile cards (< sm) */}
          <div className="sm:hidden space-y-2">
            {/* Pull-to-refresh hint — shown at top when idle */}
            {!pulling && !loading && (
              <div className="flex justify-center py-1">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Tarik untuk refresh
                </span>
              </div>
            )}
            {orders.length === 0 && !loading && (
              <div className="card py-8 text-center text-gray-400">Tidak ada order ditemukan</div>
            )}
            {orders.map((order) => (
              <div key={order.id} className="card py-3 px-4 flex items-center gap-3">
                {/* Kiri: kode + nama */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-indigo-700 text-sm leading-tight">{order.orderCode}</p>
                  <p className="text-gray-800 text-sm truncate">{order.customer?.nama}</p>
                </div>
                {/* Tengah: status */}
                <div className="flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                {/* Kanan: aksi */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {order.notes && (
                    <button
                      onClick={() => setInfoOrder(order)}
                      title="Lihat detail item & catatan"
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                  {order.status === 'INTAKE' && (
                    <button
                      onClick={() => setDeleteOrder(order)}
                      title="Hapus order"
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handlePrint(order)}
                    title="Cetak ulang nota"
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

          </div>

          {/* Desktop table (≥ sm) */}
          <div className="card p-0 overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-semibold text-gray-600">Kode Order</th>
                  <th className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-semibold text-gray-600">Nama Santri</th>
                  <th className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-semibold text-gray-600">Kamar / Kelas</th>
                  <th className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-semibold text-gray-600 hidden md:table-cell">Tgl. Masuk</th>
                  <th className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-semibold text-gray-600 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Tidak ada order ditemukan
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs font-mono font-bold text-indigo-700">{order.orderCode}</td>
                    <td className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs text-gray-800">{order.customer?.nama}</td>
                    <td className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs text-gray-600">{order.customer?.kamar} / {order.customer?.kelas}</td>
                    <td className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 mobile-landscape:text-xs text-gray-500 hidden md:table-cell">
                      {new Date(order.createdAt).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 mobile-landscape:px-2 mobile-landscape:py-1.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        {order.notes && (
                          <button
                            onClick={() => setInfoOrder(order)}
                            title="Lihat detail item & catatan"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Info
                          </button>
                        )}
                        {order.status === 'INTAKE' && (
                          <button
                            onClick={() => setDeleteOrder(order)}
                            title="Hapus order"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Hapus
                          </button>
                        )}
                        <button
                          onClick={() => handlePrint(order)}
                          title="Cetak ulang nota"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Cetak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Sebelumnya
            </button>
            <span className="text-sm text-gray-500">
              Halaman {page} / {pagination.totalPages}
            </span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya →
            </button>
          </div>
        )}
      </div>

      {infoOrder && <InfoModal order={infoOrder} onClose={() => setInfoOrder(null)} />}

      {/* Confirm Delete Modal */}
      {deleteOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteOrder(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Hapus Order?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-1">Anda akan menghapus order:</p>
            <p className="font-mono font-bold text-indigo-700 text-sm">{deleteOrder.orderCode}</p>
            <p className="text-sm text-gray-800">{deleteOrder.customer?.nama}</p>
            <p className="text-xs text-red-500 mt-3 mb-5">Order yang dihapus tidak bisa dipulihkan kembali.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteOrder(null)} disabled={deleting} className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                Kembali
              </button>
              <button onClick={handleConfirmDelete} disabled={deleting} className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
