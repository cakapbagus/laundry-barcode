import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';
import { useAppConfigStore } from '../stores/appConfigStore';

interface Machine {
  id: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
  createdAt: string;
}

const CATEGORY_LABEL: Record<string, string> = { WASH: 'W', DRY: 'D', IRON: 'I' };
const CATEGORY_COLOR: Record<string, string> = {
  WASH: 'bg-blue-100 text-blue-700',
  DRY: 'bg-orange-100 text-orange-700',
  IRON: 'bg-purple-100 text-purple-700',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    COMPLETION_DAYS: '3',
    STUCK_HOURS: '2',
    PRINT_COPIES: '2',
    PAPER_WIDTH: '80',
    APP_TITLE: 'Laundry Pesantren',
    APP_SLOGAN: 'Sistem Pelacak Cucian',
  });
  const loadConfig = useAppConfigStore((s) => s.loadConfig);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [newMachine, setNewMachine] = useState({ code: '', name: '', category: '' });
  const [addingMachine, setAddingMachine] = useState(false);
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function loadMachines() {
    try {
      const res = await apiClient.get('/machines');
      setMachines(res.data);
    } catch {
      // silent
    }
  }

  async function loadSettings() {
    try {
      const res = await apiClient.get('/settings');
      const fetched = res.data;
      setSettings(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(fetched).filter(([, v]) => v != null && v !== '')
        ),
      }));
    } catch {
      // silent
    }
  }

  useEffect(() => {
    loadMachines();
    loadSettings();
  }, []);

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      await Promise.all([
        apiClient.put('/settings/COMPLETION_DAYS', { value: settings.COMPLETION_DAYS }),
        apiClient.put('/settings/STUCK_HOURS', { value: settings.STUCK_HOURS }),
        apiClient.put('/settings/PRINT_COPIES', { value: settings.PRINT_COPIES }),
        apiClient.put('/settings/PAPER_WIDTH', { value: settings.PAPER_WIDTH }),
        apiClient.put('/settings/APP_TITLE', { value: settings.APP_TITLE }),
        apiClient.put('/settings/APP_SLOGAN', { value: settings.APP_SLOGAN }),
      ]);
      setSavedSettings(true);
      setTimeout(() => setSavedSettings(false), 1500);
      loadConfig();
    } catch {
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddMachine() {
    setAddingMachine(true);
    try {
      await apiClient.post('/machines', {
        code: newMachine.code.trim(),
        name: newMachine.name.trim(),
        category: newMachine.category,
      });
      setNewMachine({ code: '', name: '', category: '' });
      setShowMachineForm(false);
      await loadMachines();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Gagal menambah mesin.');
    } finally {
      setAddingMachine(false);
    }
  }

  async function handleToggleMachine(m: Machine) {
    try {
      await apiClient.put(`/machines/${m.id}`, { active: !m.active });
      await loadMachines();
    } catch {
      // silent
    }
  }

  function handleDeleteMachine(m: Machine) {
    setDeletingMachine(m);
  }

  async function confirmDeleteMachine() {
    if (!deletingMachine) return;
    setConfirmingDelete(true);
    try {
      await apiClient.delete(`/machines/${deletingMachine.id}`);
      setDeletingMachine(null);
      await loadMachines();
    } catch {
      // silent
    } finally {
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 mobile-landscape:py-1.5 lg:py-6 pb-nav">
        <div className="mb-3 mobile-landscape:mb-1.5 lg:mb-6">
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Pengaturan & Mesin</h1>
          <p className="text-sm text-gray-500 mt-0.5 hidden sm:block mobile-landscape:!hidden">Konfigurasi sistem dan kelola mesin</p>
        </div>

        <div className="grid md:grid-cols-2 mobile-landscape:grid-cols-2 gap-3 lg:gap-6 mobile-landscape:gap-2">
          {/* Settings Form card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mobile-landscape:p-2.5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 mobile-landscape:mb-1.5 sm:mb-3">Pengaturan Sistem</h2>
            <div className="space-y-2 mobile-landscape:space-y-1.5">

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap w-28 mobile-landscape:w-24 flex-shrink-0">
                  Nama Aplikasi
                </label>
                <input
                  type="text"
                  className="input-field py-1.5 mobile-landscape:py-1 text-sm flex-1"
                  placeholder="Laundry Pesantren"
                  value={settings.APP_TITLE}
                  onChange={(e) => setSettings(prev => ({ ...prev, APP_TITLE: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap w-28 mobile-landscape:w-24 flex-shrink-0">
                  Slogan
                </label>
                <input
                  type="text"
                  className="input-field py-1.5 mobile-landscape:py-1 text-sm flex-1"
                  placeholder="Sistem Pelacak Cucian"
                  value={settings.APP_SLOGAN}
                  onChange={(e) => setSettings(prev => ({ ...prev, APP_SLOGAN: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap w-28 mobile-landscape:w-24 flex-shrink-0">
                  Est. Selesai (hari)
                </label>
                <input
                  type="number"
                  className="input-field py-1.5 mobile-landscape:py-1 text-sm flex-1"
                  placeholder="3"
                  value={settings.COMPLETION_DAYS}
                  onChange={(e) => setSettings(prev => ({ ...prev, COMPLETION_DAYS: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap w-28 mobile-landscape:w-24 flex-shrink-0">
                  Tenggat (jam)
                </label>
                <input
                  type="number"
                  className="input-field py-1.5 mobile-landscape:py-1 text-sm flex-1"
                  placeholder="2"
                  value={settings.STUCK_HOURS}
                  onChange={(e) => setSettings(prev => ({ ...prev, STUCK_HOURS: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap w-28 mobile-landscape:w-24 flex-shrink-0">
                  Cetak Nota (copy)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  className="input-field py-1.5 mobile-landscape:py-1 text-sm flex-1"
                  placeholder="2"
                  value={settings.PRINT_COPIES}
                  onChange={(e) => setSettings(prev => ({ ...prev, PRINT_COPIES: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap w-28 mobile-landscape:w-24 flex-shrink-0">
                  Ukuran Kertas
                </label>
                <select
                  className="input-field py-1.5 mobile-landscape:py-1 text-sm flex-1"
                  value={settings.PAPER_WIDTH}
                  onChange={(e) => setSettings(prev => ({ ...prev, PAPER_WIDTH: e.target.value }))}
                >
                  <optgroup label="Thermal / Struk">
                    <option value="58">58mm — Thermal 2¼″</option>
                    <option value="72">72mm — Thermal 2¾″</option>
                    <option value="76">76mm — Thermal 3″ kecil</option>
                    <option value="80">80mm — Thermal 3⅛″ (standar)</option>
                    <option value="104">104mm — Thermal 4″</option>
                  </optgroup>
                  <optgroup label="Kertas Standar">
                    <option value="A5">A5 — 148 × 210mm</option>
                    <option value="A4">A4 — 210 × 297mm</option>
                    <option value="F4">F4/Folio — 210 × 330mm</option>
                    <option value="LETTER">Letter — 216 × 279mm</option>
                  </optgroup>
                </select>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings || savedSettings}
                className={`w-full py-1.5 mobile-landscape:py-1 text-sm font-medium rounded-lg transition-colors duration-200 ${savedSettings ? 'bg-green-600 text-white' : 'btn-primary'}`}
              >
                {savingSettings ? 'Menyimpan...' : savedSettings ? 'Disimpan ✓' : 'Simpan Pengaturan'}
              </button>
            </div>
          </div>

          {/* Machines card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mobile-landscape:p-2.5 sm:p-6">
            <div className="flex items-center justify-between mb-2 mobile-landscape:mb-1.5 sm:mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Daftar Mesin</h2>
              <button
                onClick={() => { setNewMachine({ code: '', name: '', category: '' }); setShowMachineForm(true); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tambah
              </button>
            </div>

            {/* Machine list */}
            {machines.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Belum ada mesin terdaftar</p>
            ) : (
              <ul className="space-y-1.5 mobile-landscape:space-y-1">
                {machines.map((m) => (
                  <li
                    key={m.id}
                    className={`flex items-center gap-2 px-2.5 py-2 mobile-landscape:py-1.5 rounded-lg border border-gray-100 bg-gray-50 ${m.active ? '' : 'opacity-60'}`}
                  >
                    <span className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold flex-shrink-0 ${CATEGORY_COLOR[m.category] || 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_LABEL[m.category] || m.category}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-800 leading-tight truncate">
                        {m.name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400 font-mono">{m.code}</p>
                    </div>
                    <button
                      onClick={() => handleToggleMachine(m)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${m.active ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      title={m.active ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${m.active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteMachine(m)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Hapus mesin"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

      {/* Add machine modal */}
      {showMachineForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMachineForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tambah Mesin</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Mesin</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Contoh: W01"
                  value={newMachine.code}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, code: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Mesin</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Contoh: Mesin Cuci 1"
                  value={newMachine.name}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select
                  className="input-field"
                  value={newMachine.category}
                  onChange={(e) => setNewMachine(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">Pilih kategori</option>
                  <option value="WASH">Cuci (WASH)</option>
                  <option value="DRY">Kering (DRY)</option>
                  <option value="IRON">Setrika (IRON)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowMachineForm(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleAddMachine}
                disabled={addingMachine || !newMachine.code.trim() || !newMachine.name.trim() || !newMachine.category}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {addingMachine ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete machine modal */}
      {deletingMachine && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeletingMachine(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Hapus Mesin?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Yakin ingin menghapus mesin{' '}
              <span className="font-semibold text-gray-800">{deletingMachine.name}</span>{' '}
              <span className="font-mono text-xs text-gray-500">({deletingMachine.code})</span>?
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingMachine(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteMachine}
                disabled={confirmingDelete}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {confirmingDelete ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
