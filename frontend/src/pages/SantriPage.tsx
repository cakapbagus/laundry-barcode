import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';

interface Customer {
  id: string;
  nis: string;
  nama: string;
  kamar: string;
  kelas: string;
  aktif: boolean;
}

const emptyForm = { nis: '', nama: '', kamar: '', kelas: '', aktif: true };

export default function SantriPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Add / Edit modal
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk upload
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    totalRows: number; inserted: number; updated: number; skippedInvalid: number;
    errors: { row: number; nis: string; reason: string }[];
  } | null>(null);

  const fetchCustomers = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/customer', { params: q ? { q } : {} });
      setCustomers(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(search || undefined), 300);
    return () => clearTimeout(t);
  }, [search, fetchCustomers]);

  function openAdd() {
    setForm(emptyForm);
    setFormError('');
    setModalMode('add');
  }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setForm({ nis: c.nis, nama: c.nama, kamar: c.kamar, kelas: c.kelas, aktif: c.aktif });
    setFormError('');
    setModalMode('edit');
  }

  async function handleSave() {
    setFormError('');
    if (!form.nis.trim() || !form.nama.trim() || !form.kamar.trim() || !form.kelas.trim()) {
      setFormError('Semua kolom wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await apiClient.post('/customer', form);
      } else if (editTarget) {
        await apiClient.put(`/customer/${editTarget.id}`, form);
      }
      setModalMode(null);
      await fetchCustomers(search || undefined);
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAktif(c: Customer) {
    try {
      await apiClient.patch(`/customer/${c.id}/toggle-aktif`);
      await fetchCustomers(search || undefined);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/customer/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchCustomers(search || undefined);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus santri.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadTemplate() {
    const res = await apiClient.get('/customer/template', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'template_data_santri.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadTemplateXlsx() {
    const res = await apiClient.get('/customer/template/xls', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.ms-excel' }));
    const a = document.createElement('a'); a.href = url; a.download = 'template_data_santri.xls'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkUpload() {
    if (!bulkFile) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append('file', bulkFile);
      const res = await apiClient.post('/customer/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data.data);
      setBulkFile(null);
      await fetchCustomers(search || undefined);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal upload file');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 lg:py-6 pb-nav">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Data Santri</h1>
            <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">Kelola data santri terdaftar dalam sistem</p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Santri
          </button>
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            className="input-field w-full sm:max-w-xs text-sm py-2"
            placeholder="Cari nama atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Memuat data...</div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {search ? 'Tidak ada santri yang cocok dengan pencarian.' : 'Belum ada santri terdaftar.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NIS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nama</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Kamar</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Kelas</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.aktif ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.nis}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.nama}
                        <div className="sm:hidden text-xs text-gray-400 font-normal mt-0.5">{c.kamar} · {c.kelas}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.kamar}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.kelas}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleAktif(c)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            c.aktif
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                          title={c.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.aktif ? 'bg-green-500' : 'bg-red-500'}`} />
                          {c.aktif ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bulk Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Import Data Santri (Bulk Upload)</h2>
          <p className="text-xs text-gray-500 mb-3">
            Upload file CSV atau Excel (XLS/XLSX) berisi data santri. Kolom wajib:{' '}
            <span className="font-mono">nis, nama, kamar, kelas</span>. Kolom opsional:{' '}
            <span className="font-mono">aktif</span> (true/false, default: true).{' '}
            NIS yang sudah terdaftar akan <strong>diperbarui</strong> (termasuk status aktif).
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Unduh Template CSV
            </button>
            <button
              onClick={handleDownloadTemplateXlsx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Unduh Template XLS
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex-1 min-w-[200px]">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                onChange={(e) => { setBulkFile(e.target.files?.[0] || null); setUploadResult(null); }}
              />
            </label>
            <button
              onClick={handleBulkUpload}
              disabled={!bulkFile || uploading}
              className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
            >
              {uploading ? 'Mengupload...' : 'Upload'}
            </button>
          </div>

          {uploadResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
              <p className="font-semibold text-green-800 mb-1">Upload selesai</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><span className="text-gray-500">Total baris:</span> <span className="font-medium">{uploadResult.totalRows}</span></div>
                <div><span className="text-gray-500">Baru:</span> <span className="font-medium text-green-700">{uploadResult.inserted}</span></div>
                <div><span className="text-gray-500">Diperbarui:</span> <span className="font-medium text-blue-700">{uploadResult.updated}</span></div>
                <div><span className="text-gray-500">Tidak valid:</span> <span className="font-medium text-red-700">{uploadResult.skippedInvalid}</span></div>
              </div>
              {uploadResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    Lihat {uploadResult.errors.length} detail error
                  </summary>
                  <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {uploadResult.errors.map((e, i) => (
                      <li key={i} className="text-red-600">Baris {e.row} (NIS: {e.nis || '-'}): {e.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModalMode(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {modalMode === 'add' ? 'Tambah Santri' : 'Edit Santri'}
            </h3>
            <div className="space-y-3">
              {(['nis', 'nama', 'kamar', 'kelas'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field}</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={field === 'nis' ? 'Contoh: 2024001' : field === 'nama' ? 'Nama lengkap' : field === 'kamar' ? 'Contoh: A-12' : 'Contoh: X IPA 1'}
                    value={form[field]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                    autoFocus={field === 'nis'}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Status Berlangganan</label>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, aktif: !prev.aktif }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${form.aktif ? 'bg-indigo-600' : 'bg-gray-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.aktif ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className={`text-xs font-medium ${form.aktif ? 'text-green-600' : 'text-gray-400'}`}>
                  {form.aktif ? 'Aktif Berlangganan' : 'Tidak Aktif'}
                </span>
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModalMode(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Hapus Santri?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Yakin ingin menghapus{' '}
              <span className="font-semibold text-gray-800">{deleteTarget.nama}</span>{' '}
              <span className="font-mono text-xs text-gray-500">({deleteTarget.nis})</span>?
              Santri yang memiliki riwayat order tidak dapat dihapus.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
