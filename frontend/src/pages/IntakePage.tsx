import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import jsQR from 'jsqr';
import { useAuthStore } from '../stores/authStore';
import { useAppConfigStore } from '../stores/appConfigStore';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';

interface Customer {
  id: string;
  nis: string;
  nama: string;
  kamar: string;
  kelas: string;
  aktif: boolean;
  weeklyWashCount: number;
}

interface OrderResult {
  id: string;
  orderCode: string;
  qrCode: string;
  customer: Customer;
  estimatedCompletion: string;
  status: string;
}

interface NewCustomerModal {
  nis: string;
  nama: string;
  kamar: string;
  kelas: string;
}

type ScannerState = 'idle' | 'scanning' | 'found' | 'error';

export default function IntakePage() {
  useAuthStore((s) => s.user);
  const { title: appTitle, slogan: appSlogan, paperWidth } = useAppConfigStore();

  // Form state
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  // New customer modal
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerModal>({ nis: '', nama: '', kamar: '', kelas: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Print copies setting
  const [printCopies, setPrintCopies] = useState(2);

  // Kartu santri scanner
  const [showCardScanner, setShowCardScanner] = useState(false);
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [scannerMsg, setScannerMsg] = useState('');
  const [cameraError, setCameraError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRefDesktop = useRef<HTMLDivElement>(null);
  const skipSearchRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search customers
  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (customerQuery.length < 1) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/customer?q=${encodeURIComponent(customerQuery)}`);
        setCustomers(res.data);
        setShowDropdown(true);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideMobile = dropdownRef.current?.contains(target);
      const insideDesktop = dropdownRefDesktop.current?.contains(target);
      if (!insideMobile && !insideDesktop) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load PRINT_COPIES setting
  useEffect(() => {
    apiClient.get('/settings').then((res) => {
      const v = parseInt(res.data.PRINT_COPIES, 10);
      if (!isNaN(v) && v >= 1) setPrintCopies(v);
    }).catch(() => {});
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  function selectCustomer(c: Customer) {
    skipSearchRef.current = true;
    setSelectedCustomer(c);
    setCustomerQuery(c.nama);
    setShowDropdown(false);
  }

  // ─── Kartu Santri Scanner ───────────────────────────────────────────────────

  async function openCardScanner() {
    setCameraError('');
    setScannerState('idle');
    setScannerMsg('Arahkan kamera ke QR code kartu pelajar santri');
    setShowCardScanner(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        startQrLoop();
      }
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser.'
          : 'Kamera tidak dapat diakses. Gunakan input manual.'
      );
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function closeCardScanner() {
    stopCamera();
    setShowCardScanner(false);
    setScannerState('idle');
    setScannerMsg('');
    setCameraError('');
  }

  const startQrLoop = useCallback(() => {
    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code?.data) {
        handleCardQrResult(code.data);
        return; // stop loop after detection
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /**
   * Proses hasil scan QR kartu pelajar.
   * Format yang didukung:
   *   1. JSON: { "name": "...", "nis": "..." } atau { "name": "...", "id": "..." }
   *   2. NIS saja: "2024001"
   *   3. Nama saja: teks non-angka
   *   4. "NIS|Nama": "2024001|Nama Santri"
   */
  async function handleCardQrResult(raw: string) {
    stopCamera();
    setScannerState('scanning');
    setScannerMsg('QR terdeteksi, mencari data santri...');

    let parsedName = '';
    let parsedNis = '';

    // Coba parse JSON
    try {
      const obj = JSON.parse(raw);
      parsedName = obj.name || obj.nama || '';
      parsedNis = obj.nis || obj.id || obj.customerId || obj.studentId || '';
    } catch {
      // Coba format "NIS|Nama" atau "Nama|NIS"
      if (raw.includes('|')) {
        const parts = raw.split('|').map((s) => s.trim());
        const nisLike = parts.find((p) => /^\d+$/.test(p));
        const nameLike = parts.find((p) => !/^\d+$/.test(p));
        parsedNis = nisLike || '';
        parsedName = nameLike || '';
      } else if (/^\d+$/.test(raw.trim())) {
        // Hanya angka → NIS
        parsedNis = raw.trim();
      } else {
        // Teks biasa → anggap nama
        parsedName = raw.trim();
      }
    }

    // Cari ke API — prioritas: cari by NIS, lalu by nama
    const query = parsedNis || parsedName;
    try {
      const res = await apiClient.get(`/customer?q=${encodeURIComponent(query)}`);
      const results: Customer[] = res.data;

      // Cari match exact NIS atau nama
      const exact =
        results.find((c) => c.nis === parsedNis) ||
        results.find((c) => c.nama.toLowerCase() === parsedName.toLowerCase()) ||
        (results.length === 1 ? results[0] : null);

      if (exact) {
        selectCustomer(exact);
        setScannerState('found');
        setScannerMsg(`✅ Santri ditemukan: ${exact.nama} (NIS: ${exact.nis})`);
        setTimeout(() => closeCardScanner(), 1500);
      } else {
        // Tidak ditemukan — buka modal santri baru dengan data pre-filled
        setScannerState('error');
        setScannerMsg('Santri belum terdaftar. Daftarkan sebagai santri baru?');
        setNewCustomer({ nis: parsedNis, nama: parsedName, kamar: '', kelas: '' });
      }
    } catch {
      setScannerState('error');
      setScannerMsg('Gagal mencari data santri. Coba lagi atau isi manual.');
    }
  }

  function handleRegisterFromScan() {
    closeCardScanner();
    setShowNewCustomer(true);
  }

  function handleRetryScan() {
    setScannerState('idle');
    setScannerMsg('Arahkan kamera ke QR code kartu pelajar santri');
    setCameraError('');
    if (streamRef.current) {
      startQrLoop();
    } else {
      openCardScanner();
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setScannerState('scanning');
    setScannerMsg('Memproses gambar...');

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const offscreen = document.createElement('canvas');
      offscreen.width = img.width;
      offscreen.height = img.height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code?.data) {
        handleCardQrResult(code.data);
      } else {
        setScannerState('error');
        setScannerMsg('QR code tidak terdeteksi dalam gambar. Coba foto lain atau isi nama manual.');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setScannerState('error');
      setScannerMsg('Gagal membaca gambar. Coba lagi atau isi nama manual.');
    };
    img.src = url;
  }


  // ─── New Customer ───────────────────────────────────────────────────────────

  async function handleSaveNewCustomer() {
    if (!newCustomer.nis.trim() || !newCustomer.nama.trim() || !newCustomer.kamar.trim() || !newCustomer.kelas.trim()) return;
    setSavingCustomer(true);
    try {
      const res = await apiClient.post('/customer', {
        nis: newCustomer.nis.trim(),
        nama: newCustomer.nama.trim(),
        kamar: newCustomer.kamar.trim(),
        kelas: newCustomer.kelas.trim(),
      });
      selectCustomer(res.data);
      setShowNewCustomer(false);
      setNewCustomer({ nis: '', nama: '', kamar: '', kelas: '' });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal mendaftarkan santri');
    } finally {
      setSavingCustomer(false);
    }
  }

  // ─── Order Submit ───────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedCustomer) {
      setError('Pilih santri terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/orders', {
        customerId: selectedCustomer.id,
        notes: notes.trim() || undefined,
      });
      setOrderResult(res.data);
      setCustomerQuery('');
      setSelectedCustomer(null);
      setNotes('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat order');
    } finally {
      setLoading(false);
    }
  }

  // ─── Print ──────────────────────────────────────────────────────────────────

  function handlePrint() {
    if (!orderResult) return;
    const now = new Date();
    const tglMasuk = now.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const trackUrl = `${window.location.origin}/track`;

    const notaHtml = `
      <div class="copy">
        <div class="header">
          <h1>${appTitle.toUpperCase()}</h1>
          <p>${appSlogan}</p>
        </div>
        <div class="order-code">${orderResult.orderCode}</div>
        <div class="row"><span class="label">Nama Santri</span><span class="value">${orderResult.customer.nama}</span></div>
        <div class="row"><span class="label">NIS</span><span class="value">${orderResult.customer.nis}</span></div>
        <div class="row"><span class="label">Kamar</span><span class="value">${orderResult.customer.kamar}</span></div>
        <div class="row"><span class="label">Kelas</span><span class="value">${orderResult.customer.kelas}</span></div>
        <div class="row"><span class="label">Tgl. Masuk</span><span class="value">${tglMasuk}</span></div>
        <div class="divider"></div>
        <div class="qr">
          <p class="qr-label">Scan QR untuk lacak cucian:</p>
          <img src="${orderResult.qrCode}" alt="QR Code" />
          <p>atau</p>
          <p class="track-url">Buka situs: ${trackUrl}</p>
          <p class="track-url">Masukkan kode order: <b>${orderResult.orderCode}</b></p>
        </div>
        <div class="footer">
          <p>Terima kasih atas kepercayaan Anda!</p>
        </div>
      </div>`;

    const copies = Array.from({ length: printCopies }, () => notaHtml).join('');

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
        <title>Nota Laundry - ${orderResult.orderCode}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: auto; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px; color: #000;
            padding: 3mm 4mm;
            ${/^\d+$/.test(paperWidth) ? `width:${paperWidth}mm;` : 'width:100%;'}
          }
          .copy { break-after: page; }
          .copy:last-child { break-after: avoid; }
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
        </style>
      </head>
      <body>
        ${copies}
        <script>
          (function() {
            var pw = '${paperWidth}';
            var isTherm = /^\\d+$/.test(pw);
            var namedSize = { A4:'A4', A5:'A5', F4:'210mm 330mm', LETTER:'letter' };
            function applyAndPrint() {
              var s = document.createElement('style');
              if (isTherm) {
                var h = document.body.scrollHeight;
                var perPage = Math.ceil(h / ${printCopies});
                s.textContent = '@page{size:' + pw + 'mm ' + perPage + 'px;margin:0;}';
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── Mobile: success view ATAU form (tidak keduanya) ─────────────────── */}
      <div className="lg:hidden">
        {orderResult ? (
          <div className="flex flex-col items-center justify-center text-center
                          min-h-[calc(100dvh-3.5rem)] px-3
                          mobile-landscape:flex-row mobile-landscape:items-center
                          mobile-landscape:gap-4 mobile-landscape:text-left mobile-landscape:px-4">

            {/* Kiri (portrait: atas) — icon + judul + kode order */}
            <div className="flex flex-col items-center
                            mobile-landscape:items-start mobile-landscape:flex-1 mobile-landscape:min-w-0">
              <div className="w-12 h-12 mobile-landscape:w-10 mobile-landscape:h-10
                              bg-green-100 rounded-full flex items-center justify-center mb-2">
                <svg className="w-7 h-7 mobile-landscape:w-6 mobile-landscape:h-6 text-green-600"
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Order Berhasil Dibuat!</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-3 mobile-landscape:mb-2">Cucian siap diproses</p>
              <div className="font-mono text-xl mobile-landscape:text-lg font-bold text-indigo-700
                              bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl tracking-widest">
                {orderResult.orderCode}
              </div>
            </div>

            {/* Kanan (portrait: bawah) — detail + tombol */}
            <div className="w-full max-w-xs mobile-landscape:flex-1 mobile-landscape:min-w-0 mt-3 mobile-landscape:mt-0">
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-3 text-left">
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-xs text-gray-500 flex-shrink-0 mr-2">Santri</span>
                  <span className="text-xs font-semibold text-gray-900 text-right truncate">{orderResult.customer.nama}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-xs text-gray-500 flex-shrink-0 mr-2">NIS</span>
                  <span className="text-xs font-mono text-gray-800">{orderResult.customer.nis}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-xs text-gray-500 flex-shrink-0 mr-2">Kamar · Kelas</span>
                  <span className="text-xs text-gray-800">{orderResult.customer.kamar} · {orderResult.customer.kelas}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-xs text-gray-500 flex-shrink-0 mr-2">Est. Selesai</span>
                  <span className="text-xs font-medium text-gray-800 text-right">
                    {new Date(orderResult.estimatedCompletion).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 mobile-landscape:flex-row">
                <button onClick={handlePrint}
                  className="btn-primary w-full py-3 mobile-landscape:py-2.5 text-sm flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Cetak Nota ({printCopies} copy)
                </button>
                <button onClick={() => setOrderResult(null)} className="btn-secondary w-full py-3 mobile-landscape:py-2.5 text-sm">
                  Order Baru
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 pb-nav">
            <div className="mb-3">
              <h1 className="text-lg font-bold text-gray-900">Penerimaan Cucian</h1>
            </div>
            <div className="card p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Santri <span className="text-red-500">*</span>
                  </label>
                  <div ref={dropdownRef} className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          className="input-field pr-10"
                          placeholder="Ketik nama atau NIS..."
                          value={customerQuery}
                          onChange={(e) => { setCustomerQuery(e.target.value); setSelectedCustomer(null); }}
                        />
                        {selectedCustomer && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={openCardScanner} title="Scan QR" className="btn-secondary text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        <span className="hidden sm:inline">Scan QR</span>
                      </button>
                      <button type="button" onClick={() => setShowNewCustomer(true)} title="Tambah santri baru" className="btn-secondary text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span className="hidden sm:inline">Santri Baru</span>
                      </button>
                    </div>
                    {showDropdown && customers.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                        {customers.map((c) => (
                          <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm transition-colors">
                            <span className="font-medium text-gray-800">{c.nama}</span>
                            <span className="ml-2 text-gray-400 text-xs">NIS: {c.nis}</span>
                            <span className="ml-1 text-gray-400 text-xs">· {c.kamar} · {c.kelas}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showDropdown && customerQuery.length > 0 && customers.length === 0 && (
                      <div className="absolute z-10 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500 w-full">
                        Santri tidak ditemukan — gunakan tombol &quot;+ Santri Baru&quot;
                      </div>
                    )}
                  </div>
                  {selectedCustomer && (
                    <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border ${selectedCustomer.aktif ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                      <svg className={`w-4 h-4 flex-shrink-0 ${selectedCustomer.aktif ? 'text-indigo-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${selectedCustomer.aktif ? 'text-indigo-800' : 'text-red-800'}`}>{selectedCustomer.nama}</span>
                        <span className={`text-xs ml-2 ${selectedCustomer.aktif ? 'text-indigo-500' : 'text-red-500'}`}>NIS: {selectedCustomer.nis}</span>
                        <span className={`text-xs ml-1 ${selectedCustomer.aktif ? 'text-indigo-400' : 'text-red-400'}`}>· {selectedCustomer.kamar} · {selectedCustomer.kelas}</span>
                        {!selectedCustomer.aktif && (
                          <span className="block text-xs text-red-600 font-medium mt-0.5">Tidak aktif berlangganan — tidak dapat membuat order</span>
                        )}
                      </div>
                      <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerQuery(''); }}
                        className={`ml-auto ${selectedCustomer.aktif ? 'text-indigo-400 hover:text-indigo-600' : 'text-red-400 hover:text-red-600'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan <span className="text-gray-400 font-normal">(opsional)</span>
                  </label>
                  <textarea className="input-field resize-none" rows={2} placeholder="Catatan khusus..."
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {selectedCustomer && (
                  <button type="submit" disabled={loading || !selectedCustomer.aktif}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>Memproses...</>
                    ) : (
                      <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>Buat Order</>
                    )}
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop: success card (jika ada) + form selalu tampil ────────────── */}
      <div className="hidden lg:block max-w-2xl mx-auto px-4 py-3 lg:py-6 pb-nav">
        <div className="mb-3 lg:mb-6">
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Penerimaan Cucian</h1>
          <p className="hidden lg:block text-gray-500 mt-1">Daftarkan cucian baru untuk santri</p>
        </div>

        {/* Desktop success card */}
        {orderResult && (
          <div className="card border-green-200 bg-green-50 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">Order Berhasil Dibuat!</h3>
                <div className="mt-3 flex gap-4 items-start">
                  <div className="flex-1 space-y-1 text-sm text-green-700">
                    <p><span className="font-medium">Kode Order:</span> <span className="font-mono font-bold text-lg">{orderResult.orderCode}</span></p>
                    <p><span className="font-medium">Santri:</span> {orderResult.customer.nama}</p>
                    <p><span className="font-medium">NIS:</span> {orderResult.customer.nis}</p>
                    <p><span className="font-medium">Kamar:</span> {orderResult.customer.kamar} &nbsp;|&nbsp; <span className="font-medium">Kelas:</span> {orderResult.customer.kelas}</p>
                    <p><span className="font-medium">Est. Selesai:</span> {new Date(orderResult.estimatedCompletion).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <img src={orderResult.qrCode} alt="QR Code" className="w-24 h-24 flex-shrink-0 rounded border border-green-200" />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handlePrint} className="btn-primary text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Cetak Nota ({printCopies} copy)
                  </button>
                  <button onClick={() => setOrderResult(null)} className="btn-secondary text-sm">
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card p-4 lg:p-6">
          <h2 className="hidden lg:block text-lg font-semibold text-gray-800 mb-5">Form Penerimaan</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
            {/* Customer Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Santri <span className="text-red-500">*</span>
              </label>

              <div ref={dropdownRefDesktop} className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="input-field pr-10"
                      placeholder="Ketik nama atau NIS..."
                      value={customerQuery}
                      onChange={(e) => {
                        setCustomerQuery(e.target.value);
                        setSelectedCustomer(null);
                      }}
                    />
                    {selectedCustomer && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Scan QR — visible on all screens */}
                  <button
                    type="button"
                    onClick={openCardScanner}
                    title="Scan QR Kartu Pelajar"
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <span className="hidden sm:inline">Scan QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    title="Tambah santri baru"
                    className="btn-secondary text-sm whitespace-nowrap flex items-center gap-1"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className="hidden sm:inline">Santri Baru</span>
                  </button>
                </div>

                {showDropdown && customers.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto" onMouseDown={e => e.preventDefault()}>
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm transition-colors"
                      >
                        <span className="font-medium text-gray-800">{c.nama}</span>
                        <span className="ml-2 text-gray-400 text-xs">NIS: {c.nis}</span>
                        <span className="ml-1 text-gray-400 text-xs">· {c.kamar} · {c.kelas}</span>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && customerQuery.length > 0 && customers.length === 0 && (
                  <div className="absolute z-10 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500 w-full">
                    Santri tidak ditemukan — gunakan tombol &quot;+ Santri Baru&quot;
                  </div>
                )}
              </div>

              {/* Selected customer badge */}
              {selectedCustomer && (
                <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border ${selectedCustomer.aktif ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                  <svg className={`w-4 h-4 flex-shrink-0 ${selectedCustomer.aktif ? 'text-indigo-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${selectedCustomer.aktif ? 'text-indigo-800' : 'text-red-800'}`}>{selectedCustomer.nama}</span>
                    <span className={`text-xs ml-2 ${selectedCustomer.aktif ? 'text-indigo-500' : 'text-red-500'}`}>NIS: {selectedCustomer.nis}</span>
                    <span className={`text-xs ml-1 ${selectedCustomer.aktif ? 'text-indigo-400' : 'text-red-400'}`}>· {selectedCustomer.kamar} · {selectedCustomer.kelas}</span>
                    {!selectedCustomer.aktif && (
                      <span className="block text-xs text-red-600 font-medium mt-0.5">Tidak aktif berlangganan — tidak dapat membuat order</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomer(null); setCustomerQuery(''); }}
                    className={`ml-auto flex-shrink-0 ${selectedCustomer.aktif ? 'text-indigo-400 hover:text-indigo-600' : 'text-red-400 hover:text-red-600'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <textarea
                className="input-field resize-none"
                rows={2}
                placeholder="Catatan khusus..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedCustomer || !selectedCustomer.aktif}
              className={`btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                !selectedCustomer ? 'hidden lg:flex' : ''
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Buat Order
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── Modal: Scan Kartu Pelajar ─────────────────────────────────────────── */}
      {showCardScanner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          {/*
            Portrait  : flex-col, kamera atas (4:3), kontrol bawah
            Landscape : flex-row, kamera kiri (fixed height), kontrol kanan
          */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden
                          mobile-landscape:max-w-2xl mobile-landscape:flex mobile-landscape:flex-row mobile-landscape:max-h-[92dvh]">

            {/* ── Kamera (kiri di landscape, atas di portrait) ── */}
            <div className="relative bg-black aspect-[4/3] mobile-landscape:aspect-auto mobile-landscape:w-72 mobile-landscape:flex-shrink-0">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder overlay */}
              {scannerState === 'idle' && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-44 h-44 mobile-landscape:w-36 mobile-landscape:h-36">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-sm" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-sm" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-sm" />
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-400 opacity-75 animate-bounce" style={{ animationDuration: '2s' }} />
                  </div>
                </div>
              )}

              {scannerState === 'scanning' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <svg className="animate-spin w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm">Mencari data santri...</p>
                  </div>
                </div>
              )}

              {scannerState === 'found' && (
                <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                  <div className="text-center text-white">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="font-semibold">Ditemukan!</p>
                  </div>
                </div>
              )}

              {(scannerState === 'error' || cameraError) && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6">
                  <div className="text-center text-white">
                    <svg className="w-10 h-10 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                    </svg>
                    <p className="text-sm">{cameraError || scannerMsg}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Kontrol (kanan di landscape, bawah di portrait) ── */}
            <div className="mobile-landscape:flex mobile-landscape:flex-col mobile-landscape:flex-1 mobile-landscape:overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b mobile-landscape:flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm mobile-landscape:text-base">Scan Kartu Pelajar</h3>
                  <p className="text-xs text-gray-500 mt-0.5 hidden mobile-landscape:block">Arahkan kamera ke QR code di kartu santri</p>
                </div>
                <button onClick={closeCardScanner} className="text-gray-400 hover:text-gray-600 ml-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Hidden file input for image upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* Status & actions */}
              <div className="px-4 py-4 mobile-landscape:flex-1 mobile-landscape:flex mobile-landscape:flex-col mobile-landscape:justify-center">
                {scannerMsg && scannerState !== 'error' && !cameraError && (
                  <p className={`text-sm text-center mb-3 ${
                    scannerState === 'found' ? 'text-green-600 font-medium' : 'text-gray-500'
                  }`}>
                    {scannerMsg}
                  </p>
                )}

                <div className="flex gap-2 mobile-landscape:flex-col">
                  {scannerState === 'error' && !cameraError && (
                    <>
                      <button onClick={handleRegisterFromScan} className="btn-primary flex-1 text-sm">
                        Daftarkan Santri Baru
                      </button>
                      <button onClick={handleRetryScan} className="btn-secondary text-sm px-3 mobile-landscape:px-0">
                        Scan Ulang
                      </button>
                    </>
                  )}
                  {cameraError && (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-primary flex-1 text-sm flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Foto QR
                      </button>
                      <button onClick={closeCardScanner} className="btn-secondary text-sm px-3 mobile-landscape:px-0">
                        Isi Manual
                      </button>
                    </>
                  )}
                  {(scannerState === 'idle' || scannerState === 'scanning') && !cameraError && (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
                        title="Upload gambar QR code"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Upload Gambar</span>
                      </button>
                      <button onClick={closeCardScanner} className="btn-secondary text-sm px-3 mobile-landscape:px-0">
                        Batal
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Modal: Santri Baru ────────────────────────────────────────────────── */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Daftarkan Santri Baru</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor Induk Santri (NIS) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Contoh: 2024001"
                  value={newCustomer.nis}
                  onChange={(e) => setNewCustomer({ ...newCustomer, nis: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Santri <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nama lengkap santri..."
                  value={newCustomer.nama}
                  onChange={(e) => setNewCustomer({ ...newCustomer, nama: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kamar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Contoh: A-12"
                    value={newCustomer.kamar}
                    onChange={(e) => setNewCustomer({ ...newCustomer, kamar: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kelas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Contoh: X IPA 1"
                    value={newCustomer.kelas}
                    onChange={(e) => setNewCustomer({ ...newCustomer, kelas: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSaveNewCustomer}
                disabled={savingCustomer || !newCustomer.nis.trim() || !newCustomer.nama.trim() || !newCustomer.kamar.trim() || !newCustomer.kelas.trim()}
                className="btn-primary flex-1"
              >
                {savingCustomer ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                onClick={() => { setShowNewCustomer(false); setNewCustomer({ nis: '', nama: '', kamar: '', kelas: '' }); }}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB Scan Kartu — mobile & tablet only, hidden when name is filled */}
      {/* portrait: bottom center | mobile-landscape: bottom-right corner */}
      <div className={`lg:hidden fixed z-40 pointer-events-none fab-above-nav
        inset-x-0 flex justify-center
        mobile-landscape:inset-x-auto mobile-landscape:right-4 mobile-landscape:justify-end
        ${selectedCustomer || orderResult ? 'hidden' : ''}
      `}>
        <button
          type="button"
          onClick={openCardScanner}
          title="Scan Kartu Pelajar Santri"
          className="pointer-events-auto w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full shadow-xl transition-all flex items-center justify-center"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
