import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  KASIR: 'Kasir',
  OPERATOR: 'Operator',
};

interface NavLink {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const IconDashboard = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

const IconScanner = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v4a2 2 0 002 2h2M5 8V6a2 2 0 012-2h2M5 8H3m0 0V6a2 2 0 012-2h2" />
  </svg>
);

const IconScannerLg = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v4a2 2 0 002 2h2M5 8V6a2 2 0 012-2h2M5 8H3m0 0V6a2 2 0 012-2h2" />
  </svg>
);

const IconIntake = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconOrders = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconUsers = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconBisnis = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconManage = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const IconChevronDown = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const IconLogout = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const BISNIS_LINKS = [
  { path: '/orders',  label: 'Order',      icon: <IconOrders /> },
  { path: '/intake',  label: 'Penerimaan', icon: <IconIntake /> },
  { path: '/scanner', label: 'Scanner',    icon: <IconScanner /> },
];

const KELOLA_LINKS = [
  { path: '/settings', label: 'Pengaturan', icon: <IconSettings /> },
  { path: '/users',    label: 'Pengguna',   icon: <IconUsers /> },
];

const NAV_LINKS: Record<string, NavLink[]> = {
  MANAGER: [
    { path: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  ],
  KASIR: [
    { path: '/intake',  label: 'Penerimaan', icon: <IconIntake /> },
    { path: '/orders',  label: 'Order',      icon: <IconOrders /> },
    { path: '/scanner', label: 'Scanner',    icon: <IconScannerLg /> },
  ],
  OPERATOR: [
    { path: '/scanner', label: 'Scanner', icon: <IconScannerLg /> },
    { path: '/orders',  label: 'Order',   icon: <IconOrders /> },
  ],
};

type Sheet = 'bisnis' | 'kelola' | null;

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openSheet, setOpenSheet] = useState<Sheet>(null);
  const bisnisRef = useRef<HTMLDivElement>(null);
  const kelolaRef = useRef<HTMLDivElement>(null);

  const isManager = user?.role === 'MANAGER';
  const bisnisActive = BISNIS_LINKS.some((l) => location.pathname === l.path);
  const kelolaActive = KELOLA_LINKS.some((l) => location.pathname === l.path);

  // Close desktop dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (window.innerWidth < 640) return;
      const inBisnis = bisnisRef.current?.contains(e.target as Node);
      const inKelola = kelolaRef.current?.contains(e.target as Node);
      if (!inBisnis && !inKelola) setOpenSheet(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on route change
  useEffect(() => { setOpenSheet(null); }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const links = user ? (NAV_LINKS[user.role] || []) : [];

  function DesktopDropdown({
    label, links: dLinks, sheet, refProp, active,
  }: {
    label: string;
    links: typeof KELOLA_LINKS;
    sheet: Sheet;
    refProp: React.RefObject<HTMLDivElement>;
    active: boolean;
  }) {
    return (
      <div className="relative" ref={refProp}>
        <button
          onClick={() => setOpenSheet(openSheet === sheet ? null : sheet)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active || openSheet === sheet
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          {label}
          <IconChevronDown />
        </button>
        {openSheet === sheet && (
          <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            {dLinks.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  location.pathname === link.path
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {link.icon}
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* ── Top navbar ───────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">

            {/* Logo + nav links */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <span className="font-bold text-gray-900 text-sm">Laundry Pesantren</span>
              </div>

              {/* Desktop nav */}
              <div className="hidden sm:flex items-center gap-1">
                {links.map((link) => (
                  <a
                    key={link.path}
                    href={link.path}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === link.path
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </a>
                ))}

                {isManager && (
                  <>
                    <DesktopDropdown label="Bisnis" links={BISNIS_LINKS} sheet="bisnis" refProp={bisnisRef} active={bisnisActive} />
                    <DesktopDropdown label="Kelola" links={KELOLA_LINKS} sheet="kelola" refProp={kelolaRef} active={kelolaActive} />
                  </>
                )}
              </div>
            </div>

            {/* User info + logout — desktop */}
            <div className="hidden sm:flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800 leading-tight">{user.name}</p>
                    <p className="text-xs text-gray-500">{ROLE_LABELS[user.role] || user.role}</p>
                  </div>
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-indigo-700">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50"
              >
                <IconLogout />
                <span>Keluar</span>
              </button>
            </div>

            {/* User avatar — mobile */}
            {user && (
              <div className="sm:hidden flex items-center gap-2">
                <div className="text-right leading-tight">
                  <p className="text-xs font-medium text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[user.role] || user.role}</p>
                </div>
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-700">{user.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Spacer */}
      <div className="h-14" />

      {/* ── Mobile bottom sheets ─────────────────────────────────── */}
      {openSheet && isManager && (
        <div className="sm:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenSheet(null)} />
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-xl overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                {openSheet === 'bisnis' ? 'Bisnis' : 'Kelola'}
              </p>
            </div>
            {(openSheet === 'bisnis' ? BISNIS_LINKS : KELOLA_LINKS).map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-5 py-4 text-sm font-medium border-b border-gray-100 last:border-0 ${
                  location.pathname === link.path
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-800 active:bg-gray-50'
                }`}
                onClick={() => setOpenSheet(null)}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom tab bar — mobile only ────────────────────────── */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {links.map((link) => {
            const active = location.pathname === link.path;
            return (
              <a
                key={link.path}
                href={link.path}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active ? 'text-indigo-600' : 'text-gray-400'
                }`}
              >
                {link.icon}
                <span className="text-[10px] font-medium leading-tight">{link.label}</span>
              </a>
            );
          })}

          {/* Bisnis tab — MANAGER only */}
          {isManager && (
            <button
              onClick={() => setOpenSheet(openSheet === 'bisnis' ? null : 'bisnis')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                bisnisActive || openSheet === 'bisnis' ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <IconBisnis />
              <span className="text-[10px] font-medium leading-tight">Bisnis</span>
            </button>
          )}

          {/* Kelola tab — MANAGER only */}
          {isManager && (
            <button
              onClick={() => setOpenSheet(openSheet === 'kelola' ? null : 'kelola')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                kelolaActive || openSheet === 'kelola' ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <IconManage />
              <span className="text-[10px] font-medium leading-tight">Kelola</span>
            </button>
          )}

          {/* Logout tab */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-400 transition-colors active:text-red-500"
          >
            <IconLogout />
            <span className="text-[10px] font-medium leading-tight">Keluar</span>
          </button>
        </div>
      </div>

      {/* ── Modal konfirmasi logout ──────────────────────────────── */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <IconLogout />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Keluar dari sistem?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Sesi Anda akan diakhiri. Anda perlu login kembali untuk mengakses sistem.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
