import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';

interface User {
  id: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = { MANAGER: 'Manager', KASIR: 'Kasir', OPERATOR: 'Operator', MUSYRIF: 'Musyrif' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ name: '', password: '', role: 'KASIR' });
  const [addingUser, setAddingUser] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [confirmingDeleteUser, setConfirmingDeleteUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', password: '', role: '' });
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  async function loadUsers() {
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data);
    } catch {}
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleAddUser() {
    if (!newUser.name.trim() || !newUser.password.trim()) return;
    setAddingUser(true);
    try {
      await apiClient.post('/users', { ...newUser, name: newUser.name.trim() });
      setNewUser({ name: '', password: '', role: 'KASIR' });
      setShowUserForm(false);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menambah pengguna');
    } finally {
      setAddingUser(false);
    }
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    setConfirmingDeleteUser(true);
    try {
      await apiClient.delete(`/users/${deletingUser.id}`);
      setDeletingUser(null);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menghapus pengguna');
    } finally {
      setConfirmingDeleteUser(false);
    }
  }

  async function handleToggleUser(u: User) {
    try {
      await apiClient.put(`/users/${u.id}`, { active: !u.active });
      loadUsers();
    } catch {
      alert('Gagal mengubah status pengguna');
    }
  }

  function openEditUser(u: User) {
    setEditingUser(u);
    setEditUserForm({ name: u.name, password: '', role: u.role });
    setShowEditPassword(false);
  }

  async function handleSaveEditUser() {
    if (!editingUser) return;
    setSavingEditUser(true);
    try {
      const payload: Record<string, string> = { name: editUserForm.name, role: editUserForm.role };
      if (editUserForm.password) payload.password = editUserForm.password;
      await apiClient.put(`/users/${editingUser.id}`, payload);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menyimpan perubahan');
    } finally {
      setSavingEditUser(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-3 lg:py-6 pb-nav">

        {/* Header */}
        <div className="flex items-center justify-between mb-3 lg:mb-6">
          <div>
            <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Kelola Pengguna</h1>
            <p className="text-sm text-gray-500 mt-0.5 hidden sm:block mobile-landscape:!hidden">Tambah, edit, dan nonaktifkan akun pengguna</p>
          </div>
          <button
            onClick={() => { setNewUser({ name: '', password: '', role: 'KASIR' }); setShowNewPassword(false); setShowUserForm(true); }}
            className="btn-primary text-sm"
          >
            + Tambah
          </button>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Nama</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Role</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Status</th>
                <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-gray-100 transition-opacity ${u.active ? '' : 'opacity-50'}`}>
                  <td className="py-2.5 px-3 font-medium text-gray-800">{u.name}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'MANAGER' ? 'bg-purple-100 text-purple-800' :
                      u.role === 'KASIR'   ? 'bg-blue-100 text-blue-800' :
                      u.role === 'MUSYRIF' ? 'bg-teal-100 text-teal-800' :
                                             'bg-orange-100 text-orange-800'
                    }`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.role !== 'MANAGER' ? (
                      <button
                        onClick={() => handleToggleUser(u)}
                        title={u.active ? 'Nonaktifkan' : 'Aktifkan'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          u.active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          u.active ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditUser(u)}
                        title="Edit"
                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.5-6.5a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                        </svg>
                      </button>
                      {u.role !== 'MANAGER' && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          title="Hapus"
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pengguna */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tambah Pengguna Baru</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pengguna</label>
                <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="input-field" placeholder="Nama pengguna" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showNewPassword ? 'text' : 'password'} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value.replace(/\s/g, '') })}
                    className="input-field pr-10" placeholder="Password" />
                  <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showNewPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="input-field">
                  <option value="KASIR">Kasir</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="MUSYRIF">Musyrif</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowUserForm(false)} className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Batal</button>
              <button onClick={handleAddUser} disabled={addingUser || !newUser.name.trim() || !newUser.password.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {addingUser ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Edit Pengguna</h3>
            <p className="text-xs text-gray-400 mb-4">Kosongkan password jika tidak ingin diubah</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                <input type="text" value={editUserForm.name} onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  className="input-field" autoFocus />
              </div>
              <div>
                {editingUser.role !== 'MANAGER' && (
                  <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })} className="input-field">
                    <option value="KASIR">Kasir</option>
                    <option value="OPERATOR">Operator</option>
                    <option value="MUSYRIF">Musyrif</option>
                  </select>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <div className="relative">
                  <input type={showEditPassword ? 'text' : 'password'} value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value.replace(/\s/g, '') })}
                    className="input-field pr-10" placeholder="Kosongkan jika tidak diubah" />
                  <button type="button" onClick={() => setShowEditPassword((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showEditPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Batal</button>
              <button onClick={handleSaveEditUser} disabled={savingEditUser || !editUserForm.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {savingEditUser ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Pengguna */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeletingUser(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Hapus Pengguna?</h3>
            <p className="text-sm text-gray-500 mb-1">Anda akan menghapus pengguna:</p>
            <p className="text-sm font-semibold text-gray-800">{deletingUser.name}</p>
            <p className="text-xs text-gray-400 mb-4">{ROLE_LABELS[deletingUser.role] || deletingUser.role}</p>
            <p className="text-xs text-red-500 mb-5">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingUser(null)} disabled={confirmingDeleteUser} className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Batal</button>
              <button onClick={confirmDeleteUser} disabled={confirmingDeleteUser} className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                {confirmingDeleteUser ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
