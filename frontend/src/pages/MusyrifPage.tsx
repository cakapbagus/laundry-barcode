import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import Navbar from '../components/Navbar';

interface Customer {
  id: string;
  nis: string;
  nama: string;
  kamar: string;
  kelas: string;
}

interface Order {
  id: string;
  orderCode: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  estimatedCompletion: string;
  customer: Customer;
}

const STATUS_LABEL: Record<string, string> = {
  FINISHED: 'Selesai',
  PICKED_UP: 'Sudah Diambil',
};

const STATUS_COLOR: Record<string, string> = {
  FINISHED: 'bg-yellow-100 text-yellow-800',
  PICKED_UP: 'bg-green-100 text-green-800',
};

export default function MusyrifPage() {
  const { token } = useAuthStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const [kamarOptions, setKamarOptions] = useState<string[]>([]);
  const [kelasOptions, setKelasOptions] = useState<string[]>([]);

  const [filterKamar, setFilterKamar] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/filters', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setKamarOptions(data.kamar || []);
      setKelasOptions(data.kelas || []);
    } catch {}
  }, [token]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filterStatus) {
        params.set('status', filterStatus);
      } else {
        // default: show FINISHED and PICKED_UP — fetch both
        params.set('status', 'FINISHED');
      }
      if (filterKamar) params.set('kamar', filterKamar);
      if (filterKelas) params.set('kelas', filterKelas);

      const res = await fetch(`/api/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      let list: Order[] = data.data || [];

      // If no status filter → also fetch PICKED_UP and merge
      if (!filterStatus) {
        const params2 = new URLSearchParams({ limit: '200', status: 'PICKED_UP' });
        if (filterKamar) params2.set('kamar', filterKamar);
        if (filterKelas) params2.set('kelas', filterKelas);
        const res2 = await fetch(`/api/orders?${params2.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res2.ok) {
          const data2 = await res2.json();
          list = [...list, ...(data2.data || [])];
        }
        // Sort by createdAt desc
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [token, filterKamar, filterKelas, filterStatus]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const belumDiambil = orders.filter((o) => o.status === 'FINISHED').length;
  const sudahDiambil = orders.filter((o) => o.status === 'PICKED_UP').length;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 sm:pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Monitoring Cucian Santri</h1>
          <p className="text-sm text-gray-500 mt-0.5">Status pengambilan cucian per kamar / kelas</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs text-yellow-700 font-medium mb-1">Belum Diambil</p>
            <p className="text-3xl font-bold text-yellow-800">{belumDiambil}</p>
            <p className="text-xs text-yellow-600 mt-0.5">order selesai</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700 font-medium mb-1">Sudah Diambil</p>
            <p className="text-3xl font-bold text-green-800">{sudahDiambil}</p>
            <p className="text-xs text-green-600 mt-0.5">order selesai</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Semua (Selesai + Diambil)</option>
                <option value="FINISHED">Selesai (Belum Diambil)</option>
                <option value="PICKED_UP">Sudah Diambil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kamar</label>
              <select
                value={filterKamar}
                onChange={(e) => setFilterKamar(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Semua Kamar</option>
                {kamarOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kelas</label>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Semua Kelas</option>
                {kelasOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          {(filterKamar || filterKelas || filterStatus) && (
            <button
              onClick={() => { setFilterKamar(''); setFilterKelas(''); setFilterStatus(''); }}
              className="mt-2 text-xs text-indigo-600 hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Table — desktop */}
        <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Memuat...</div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Tidak ada data untuk filter yang dipilih
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kode Order</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama Santri</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NIS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kamar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kelas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tgl Selesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.orderCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{order.customer?.nama}</td>
                    <td className="px-4 py-3 text-gray-500">{order.customer?.nis}</td>
                    <td className="px-4 py-3 text-gray-700">{order.customer?.kamar}</td>
                    <td className="px-4 py-3 text-gray-700">{order.customer?.kelas}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(order.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cards — mobile */}
        <div className="sm:hidden space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Tidak ada data untuk filter yang dipilih</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{order.customer?.nama}</p>
                    <p className="text-xs text-gray-500">NIS: {order.customer?.nis}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span>Kamar: <span className="font-medium text-gray-800">{order.customer?.kamar}</span></span>
                  <span>Kelas: <span className="font-medium text-gray-800">{order.customer?.kelas}</span></span>
                  <span className="col-span-2 font-mono text-gray-400">{order.orderCode}</span>
                  {order.completedAt && (
                    <span className="col-span-2 text-gray-400">Selesai: {formatDate(order.completedAt)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
