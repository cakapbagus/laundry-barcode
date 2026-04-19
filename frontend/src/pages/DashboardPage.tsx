import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';

interface KpiSummary {
  totalOrders: number;
  percentComplete: number;
  avgCycleTime: number;
}

interface Customer {
  id: string;
  nis: string;
  nama: string;
  noHape?: string | null;
  kamar: string;
  kelas: string;
}

interface Order {
  id: string;
  orderCode: string;
  customer: Customer;
  status: string;
  berat?: number | null;
  biaya?: number | null;
  createdAt: string;
  updatedAt: string;
  estimatedCompletion: string;
  history: StageHistory[];
}

interface StageHistory {
  id: string;
  fromStage: string | null;
  toStage: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  machineId: string | null;
  operator: { id: string; name: string };
  notes: string | null;
}

interface Setting {
  STUCK_HOURS: string;
}

const STAGES = ['INTAKE', 'WASHING', 'DRYING', 'IRONING', 'PACKING', 'FINISHED', 'PICKED_UP'];
const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Penerimaan',
  WASHING: 'Pencucian',
  DRYING: 'Pengeringan',
  IRONING: 'Penyetrikaan',
  PACKING: 'Pengepakan',
  FINISHED: 'Selesai',
  PICKED_UP: 'Diambil',
};
const STAGE_COLORS: Record<string, string> = {
  INTAKE: 'bg-gray-100 border-gray-200',
  WASHING: 'bg-blue-50 border-blue-200',
  DRYING: 'bg-cyan-50 border-cyan-200',
  IRONING: 'bg-orange-50 border-orange-200',
  PACKING: 'bg-purple-50 border-purple-200',
  FINISHED: 'bg-green-50 border-green-200',
  PICKED_UP: 'bg-slate-50 border-slate-200',
};
const STAGE_HEADER_COLORS: Record<string, string> = {
  INTAKE: 'text-gray-700',
  WASHING: 'text-blue-700',
  DRYING: 'text-cyan-700',
  IRONING: 'text-orange-700',
  PACKING: 'text-purple-700',
  FINISHED: 'text-green-700',
  PICKED_UP: 'text-slate-600',
};
const STAGE_PILL_COLORS: Record<string, string> = {
  INTAKE: 'bg-gray-200 text-gray-700',
  WASHING: 'bg-blue-100 text-blue-700',
  DRYING: 'bg-cyan-100 text-cyan-700',
  IRONING: 'bg-orange-100 text-orange-700',
  PACKING: 'bg-purple-100 text-purple-700',
  FINISHED: 'bg-green-100 text-green-700',
  PICKED_UP: 'bg-slate-200 text-slate-700',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}d`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}

function getTimeInStage(order: Order): number {
  const lastHistory = order.history?.[order.history.length - 1];
  if (!lastHistory) return 0;
  return Math.floor((Date.now() - new Date(lastHistory.startedAt).getTime()) / 1000);
}

function OrderCard({ order, onClick, stuckThresholdSec }: { order: Order; onClick: () => void; stuckThresholdSec: number }) {
  const timeInStage = getTimeInStage(order);
  const isStuck = timeInStage > stuckThresholdSec && order.status !== 'FINISHED' && order.status !== 'PICKED_UP';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border px-2.5 py-2 cursor-pointer hover:shadow-md transition-shadow ${isStuck ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="font-mono text-xs text-indigo-600 font-semibold truncate">{order.orderCode}</p>
        {isStuck && (
          <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
          </svg>
        )}
      </div>
      <p className="text-xs font-medium text-gray-800 mt-0.5 truncate">{order.customer?.nama}</p>
      {order.history?.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
          {order.history[order.history.length - 1]?.operator?.name} · {formatDuration(timeInStage)}
        </p>
      )}
    </div>
  );
}

function OrderDetailModal({ order, onClose, stuckThresholdSec }: { order: Order; onClose: () => void; stuckThresholdSec: number }) {
  if (!order) return null;
  const timeInStage = getTimeInStage(order);
  const isStuck = timeInStage > stuckThresholdSec && order.status !== 'FINISHED' && order.status !== 'PICKED_UP';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-gray-800 font-mono">{order.orderCode}</h3>
            <p className="text-sm text-gray-500">{order.customer?.nama} · NIS: {order.customer?.nis}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          {isStuck && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm text-red-700">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
              </svg>
              <span>Order ini diproses terlalu lama - {formatDuration(timeInStage)}.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Kamar</p>
              <p className="font-semibold">{order.customer?.kamar}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Kelas</p>
              <p className="font-semibold">{order.customer?.kelas}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Status</p>
              <p className="font-semibold">{STAGE_LABELS[order.status] || order.status}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Dibuat</p>
              <p className="font-semibold">{new Date(order.createdAt).toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">No HP</p>
              <p className="font-semibold">{order.customer.noHape || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Est. Selesai</p>
              <p className="font-semibold">{new Date(order.estimatedCompletion).toLocaleDateString('id-ID')}</p>
            </div>
            {order.berat != null && (
              <>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-amber-600 text-xs">Berat</p>
                  <p className="font-semibold">{order.berat} kg</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-amber-600 text-xs">Biaya Laundry</p>
                  <p className="font-semibold">Rp {order.biaya?.toLocaleString('id-ID') ?? '-'}</p>
                </div>
              </>
            )}
          </div>

          <h4 className="font-semibold text-gray-700 mb-3">Riwayat Proses</h4>
          <div className="space-y-2">
            {order.history?.map((h, idx) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />
                  {idx < order.history.length - 1 && <div className="w-0.5 h-full bg-gray-200 mt-1" />}
                </div>
                <div className="pb-3 flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {STAGE_LABELS[h.toStage] || h.toStage}
                  </p>
                  <p className="text-xs text-gray-500">
                    {h.operator?.name} • {new Date(h.startedAt).toLocaleString('id-ID')}
                    {h.duration && ` • ${formatDuration(h.duration)}`}
                  </p>
                  {h.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{h.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [ordersByStatus, setOrdersByStatus] = useState<Record<string, Order[]>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [settings, setSettings] = useState<Setting>({ STUCK_HOURS: '2' });
  const [visibleStages, setVisibleStages] = useState<Set<string>>(new Set(STAGES));
  // Mobile: which stages are expanded (default: all non-empty expanded)
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set(['FINISHED', 'PICKED_UP']));
  const [filterKamar, setFilterKamar] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [kpiRes, ordersRes] = await Promise.all([
        apiClient.get(`/dashboard/summary?month=${filterMonth}`),
        apiClient.get(`/dashboard/orders-by-status?month=${filterMonth}`),
      ]);
      setKpi(kpiRes.data);
      setOrdersByStatus(ordersRes.data);
    } catch {}
  }, [filterMonth]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiClient.get('/settings');
        const fetched = res.data as Partial<Setting>;
        setSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(Object.entries(fetched).filter(([, v]) => v != null && v !== '')),
        }));
      } catch {}
    }
    loadSettings();
  }, []);

  // WebSocket
  useEffect(() => {
    const socket: Socket = io('/', { path: '/socket.io' });
    socket.on('dashboard:refresh', loadDashboard);
    socket.on('order:created', loadDashboard);
    socket.on('order:stage_updated', loadDashboard);
    socket.on('order:completed', loadDashboard);
    socket.on('order:deleted', loadDashboard);
    return () => { socket.disconnect(); };
  }, [loadDashboard]);

  function toggleStage(stage: string) {
    setVisibleStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        if (next.size > 1) next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }

  function toggleAllStages() {
    if (visibleStages.size === STAGES.length) {
      setVisibleStages(new Set([STAGES[0]]));
    } else {
      setVisibleStages(new Set(STAGES));
    }
  }

  function toggleCollapse(stage: string) {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  async function handleExportCSV() {
    try {
      const res = await apiClient.get(`/dashboard/reports/daily?month=${filterMonth}`);
      const { orders } = res.data;
      const header = ['Kode Order', 'NIS', 'Nama Santri', 'Kamar', 'Kelas', 'Status', 'Dibuat', 'Est. Selesai'];
      const rows = orders.map((o: Order) => [
        o.orderCode,
        o.customer?.nis || '',
        o.customer?.nama || '',
        o.customer?.kamar || '',
        o.customer?.kelas || '',
        STAGE_LABELS[o.status] || o.status,
        new Date(o.createdAt).toLocaleString('id-ID'),
        new Date(o.estimatedCompletion).toLocaleDateString('id-ID'),
      ]);
      const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-laundry-${filterMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal mengekspor data');
    }
  }

  const stuckThresholdSec = parseFloat(settings.STUCK_HOURS || '2') * 3600;
  const activeStages = STAGES.filter((s) => visibleStages.has(s));
  const allVisible = visibleStages.size === STAGES.length;

  const allOrders = Object.values(ordersByStatus).flat();
  const uniqueKamar = [...new Set(allOrders.map((o) => o.customer?.kamar).filter(Boolean))].sort();
  const uniqueKelas = [...new Set(allOrders.map((o) => o.customer?.kelas).filter(Boolean))].sort();

  function filterOrders(orders: Order[]): Order[] {
    return orders.filter((o) => {
      if (filterKamar && o.customer?.kamar !== filterKamar) return false;
      if (filterKelas && o.customer?.kelas !== filterKelas) return false;
      return true;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-nav">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="input-field w-auto text-xs sm:text-sm py-1 sm:py-1.5"
            />
            {/* Mobile: icon only */}
            <button onClick={loadDashboard} className="sm:hidden p-1.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {/* Desktop: text button */}
            <button onClick={loadDashboard} className="hidden sm:flex btn-secondary text-sm items-center gap-1 py-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            {kpi && kpi.totalOrders > 0 && (
              <>
                {/* Mobile: icon only */}
                <button onClick={handleExportCSV} className="sm:hidden p-1.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {/* Desktop: text button */}
                <button onClick={handleExportCSV} className="hidden sm:flex btn-secondary text-sm items-center gap-2 py-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPI Bar — mobile: horizontal scroll strip, desktop: grid */}
        {kpi && (
          <>
            {/* Mobile KPI grid */}
            <div className="sm:hidden grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase">Order</p>
                <p className="text-lg font-bold text-indigo-600">{kpi.totalOrders}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase">Selesai</p>
                <p className="text-lg font-bold text-green-600">{kpi.percentComplete}%</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                <p className="text-[10px] text-gray-400 font-medium uppercase">Avg</p>
                <p className="text-lg font-bold text-purple-600">{kpi.avgCycleTime > 0 ? formatDuration(kpi.avgCycleTime) : '-'}</p>
              </div>
            </div>

            {/* Desktop KPI grid */}
            <div className="hidden sm:grid grid-cols-3 gap-3 mb-4">
              <div className="card py-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Order</p>
                <p className="text-2xl font-bold text-indigo-600 mt-0.5">{kpi.totalOrders}</p>
              </div>
              <div className="card py-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Selesai</p>
                <div className="mt-0.5">
                  <p className="text-2xl font-bold text-green-600">{kpi.percentComplete}%</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${kpi.percentComplete}%` }} />
                  </div>
                </div>
              </div>
              <div className="card py-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rata-rata Selesai</p>
                <p className="text-2xl font-bold text-purple-600 mt-0.5">
                  {kpi.avgCycleTime > 0 ? formatDuration(kpi.avgCycleTime) : '-'}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Kamar & Kelas filter */}
        {(uniqueKamar.length > 0 || uniqueKelas.length > 0) && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-medium text-gray-400 flex-shrink-0">Santri:</span>
            {uniqueKamar.length > 0 && (
              <select
                value={filterKamar}
                onChange={(e) => setFilterKamar(e.target.value)}
                className={`text-xs rounded-lg border py-0.5 px-2 pr-6 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                  filterKamar ? 'border-indigo-400 text-indigo-700 font-medium' : 'border-gray-200 text-gray-500'
                }`}
              >
                <option value="">Semua Kamar</option>
                {uniqueKamar.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            )}
            {uniqueKelas.length > 0 && (
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className={`text-xs rounded-lg border py-0.5 px-2 pr-6 bg-white transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                  filterKelas ? 'border-indigo-400 text-indigo-700 font-medium' : 'border-gray-200 text-gray-500'
                }`}
              >
                <option value="">Semua Kelas</option>
                {uniqueKelas.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            )}
            {(filterKamar || filterKelas) && (
              <button
                onClick={() => { setFilterKamar(''); setFilterKelas(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reset
              </button>
            )}
          </div>
        )}

        {/* Stage filter — collapsible */}
        <div className="mb-3">
          {/* Toggle header */}
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>Filter Tahap</span>
            {!allVisible && (
              <span className="ml-1 px-1.5 py-0 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                {visibleStages.size}/{STAGES.length}
              </span>
            )}
          </button>

          {/* Pills — shown when open */}
          {filterOpen && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-2">
              <button
                onClick={toggleAllStages}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  allVisible
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {allVisible && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Semua
              </button>
              {STAGES.map((stage) => {
                const active = visibleStages.has(stage);
                return (
                  <button
                    key={stage}
                    onClick={() => toggleStage(stage)}
                    className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? `${STAGE_PILL_COLORS[stage]} border-transparent`
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {active && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {STAGE_LABELS[stage]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Kanban Board — vertical swimlanes on mobile, horizontal columns on desktop */}

        {/* Mobile: vertical stacked */}
        <div className="sm:hidden space-y-2">
          {activeStages.map((stage) => {
            const stageOrders = filterOrders(ordersByStatus[stage] || []);
            const isCollapsed = collapsedStages.has(stage) || stageOrders.length === 0;
            const isEmpty = stageOrders.length === 0;
            return (
              <div key={stage} className={`rounded-xl border ${STAGE_COLORS[stage]} overflow-hidden`}>
                {/* Section header — tappable */}
                <button
                  onClick={() => !isEmpty && toggleCollapse(stage)}
                  className={`w-full flex items-center justify-between px-3 py-2 ${isEmpty ? 'cursor-default opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wide ${STAGE_HEADER_COLORS[stage]}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-xs font-semibold bg-white/80 text-gray-600 border border-gray-200 rounded-full px-1.5 py-0">
                      {stageOrders.length}
                    </span>
                  </div>
                  {!isEmpty && (
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {/* Cards — shown when expanded */}
                {!isCollapsed && (
                  <div className="px-2 pb-2 grid grid-cols-2 gap-1.5">
                    {stageOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        stuckThresholdSec={stuckThresholdSec}
                        onClick={() => setSelectedOrder(order)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop: horizontal columns */}
        <div className="hidden sm:block overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-0" style={{ minWidth: `${activeStages.length * 152}px` }}>
            {activeStages.map((stage) => {
              const stageOrders = filterOrders(ordersByStatus[stage] || []);
              return (
                <div
                  key={stage}
                  className={`flex-1 min-w-[136px] rounded-xl border ${STAGE_COLORS[stage]} flex flex-col`}
                >
                  <div className="px-2.5 py-2 border-b border-inherit">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide truncate">
                        {STAGE_LABELS[stage]}
                      </span>
                      <span className="badge bg-white text-gray-600 border border-gray-200 text-[10px] px-1.5 py-0 flex-shrink-0">
                        {stageOrders.length}
                      </span>
                    </div>
                  </div>
                  <div className="p-1.5 space-y-1.5 flex-1 min-h-20">
                    {stageOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        stuckThresholdSec={stuckThresholdSec}
                        onClick={() => setSelectedOrder(order)}
                      />
                    ))}
                    {stageOrders.length === 0 && (
                      <p className="text-[10px] text-gray-400 text-center py-3">Kosong</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          stuckThresholdSec={stuckThresholdSec}
        />
      )}
    </div>
  );
}
