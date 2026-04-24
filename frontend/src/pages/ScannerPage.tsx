import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';
import { useAuthStore } from '../stores/authStore';

interface Machine {
  id: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
}

const STAGE_CATEGORY: Record<string, string> = {
  WASHING: 'WASH',
  DRYING:  'DRY',
  IRONING: 'IRON',
};

interface OrderInfo {
  id: string;
  orderCode: string;
  customer: { nis: string; nama: string; kamar: string; kelas: string; noHape?: string | null };
  status: string;
  nextStage: string | null;
  estimatedCompletion: string;
}

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'Penerimaan',
  WASHING: 'Pencucian',
  DRYING: 'Pengeringan',
  IRONING: 'Penyetrikaan',
  PACKING: 'Pengepakan',
  FINISHED: 'Selesai / Siap Diambil',
  PICKED_UP: 'Sudah Diambil',
};

function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 220;
    osc.type = success ? 'sine' : 'square';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export default function ScannerPage() {
  const { user } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [notes, setNotes] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error' | 'warning'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    loadMachines();
    return () => stopCamera();
  }, []);

  async function loadMachines() {
    try {
      const res = await apiClient.get('/machines?active=true');
      setMachines(res.data);
    } catch {}
  }

  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startScanning();
      }
    } catch (err: any) {
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
    }
  }

  function stopCamera() {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function startScanning() {
    scanIntervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        // Extract order code from URL or use directly
        let orderCode = code.data;
        const urlMatch = code.data.match(/order=(\d{20})/);
        if (urlMatch) orderCode = urlMatch[1];

        if (orderCode !== lastScannedRef.current) {
          lastScannedRef.current = orderCode;
          handleQrDetected(orderCode);
        }
      }
    }, 200);
  }

  const handleQrDetected = useCallback(async (orderCode: string) => {
    try {
      const res = await apiClient.post('/scans/integrity-check', { orderCode });
      const data = res.data;

      if (!data.valid) {
        setScanStatus('error');
        setStatusMsg(data.error || 'QR tidak valid');
        setOrderInfo(null);
        playBeep(false);
        return;
      }

      // Kasir hanya boleh memproses pengambilan
      if (user?.role === 'KASIR' && data.order.nextStage !== 'PICKED_UP') {
        setScanStatus('error');
        setStatusMsg('Hanya dapat memproses pengambilan cucian');
        setOrderInfo(null);
        playBeep(false);
        return;
      }

      setOrderInfo(data.order);
      setIsDuplicate(data.isDuplicate);

      if (data.isDuplicate) {
        setScanStatus('warning');
        setStatusMsg(data.duplicateWarning);
        playBeep(false);
      } else {
        setScanStatus('success');
        setStatusMsg('Data ditemukan — Siap diproses');
        playBeep(true);
      }
    } catch {
      setScanStatus('error');
      setStatusMsg('Data tidak ditemukan!');
      playBeep(false);
    }
  }, [user]);

  async function handleTransition() {
    if (!orderInfo) return;

    const needsMachine = ['WASHING', 'DRYING', 'IRONING'].includes(orderInfo.nextStage!);
    if (needsMachine && !selectedMachine) {
      alert('Pilih mesin terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/scans/stage-transition', {
        orderCode: orderInfo.orderCode,
        machineId: selectedMachine || undefined,
        notes: notes.trim() || undefined,
      });

      const { transition } = res.data;
      setScanStatus('success');
      setStatusMsg(
        `Berhasil: ${STAGE_LABELS[transition.from] || transition.from} → ${STAGE_LABELS[transition.to] || transition.to}`
      );
      playBeep(true);

      // Reset
      setOrderInfo(null);
      setSelectedMachine('');
      setNotes('');
      setManualCode('');
      lastScannedRef.current = '';
    } catch (err: any) {
      setScanStatus('error');
      setStatusMsg(err.response?.data?.error || 'Gagal melakukan transisi');
      playBeep(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = manualCode.trim();
    if (!val) return;
    lastScannedRef.current = '';
    // Jika NIS (angka), kirim apa adanya; jika kode order, uppercase
    await handleQrDetected(/^\d+$/.test(val) ? val : val.toUpperCase());
  }

  function resetScan() {
    setOrderInfo(null);
    setScanStatus('idle');
    setStatusMsg('');
    setSelectedMachine('');
    setNotes('');
    setManualCode('');
    lastScannedRef.current = '';
    setIsDuplicate(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/*
        Portrait  : single column, max-w-lg
        Landscape : 2 columns side-by-side, full width
      */}
      <div className="max-w-lg mx-auto px-4 py-3 lg:py-6 pb-nav
                      mobile-landscape:max-w-none mobile-landscape:flex mobile-landscape:flex-row mobile-landscape:gap-3 mobile-landscape:px-3 mobile-landscape:py-2 mobile-landscape:items-start">

        {/* ── Header — hidden in landscape ── */}
        <div className="mb-3 lg:mb-6 mobile-landscape:hidden">
          <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Scanner Cucian</h1>
          <p className="hidden sm:block text-gray-500 mt-1">Scan QR code untuk memproses cucian</p>
        </div>

        {/* ── LEFT: Camera ── */}
        {!orderInfo && (
          <div className="card mb-3 p-3 lg:p-6 mobile-landscape:mb-0 mobile-landscape:w-1/2 mobile-landscape:flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-800 text-sm lg:text-base">Kamera QR</h2>
              <button
                onClick={cameraActive ? stopCamera : startCamera}
                className={cameraActive ? 'btn-danger text-sm' : 'btn-primary text-sm'}
              >
                {cameraActive ? 'Matikan' : 'Nyalakan'}
              </button>
            </div>

            <div className="relative bg-gray-900 rounded-lg overflow-hidden max-h-52 sm:max-h-none mobile-landscape:max-h-none" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <svg className="w-16 h-16 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-400 text-sm">Tekan Nyalakan Kamera</p>
                </div>
              )}

              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/70 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br" />
                  </div>
                </div>
              )}
            </div>

            {cameraError && <p className="mt-2 text-sm text-red-600">{cameraError}</p>}
          </div>
        )}

        {/* ── RIGHT: Status + Order Info + Manual Input ── */}
        <div className="mobile-landscape:flex-1 mobile-landscape:overflow-y-auto mobile-landscape:max-h-[calc(100dvh-56px-16px)]">

          {/* Title — hanya tampil di mobile-landscape (di dalam kolom kanan) */}
          <h1 className="hidden mobile-landscape:block text-lg font-bold text-gray-900 mb-2">Scanner Cucian</h1>

          {/* Scan Status */}
          {scanStatus !== 'idle' && (
            <div className={`mb-2 p-2 mobile-landscape:py-1 mobile-landscape:px-2 rounded-lg flex items-center gap-2 ${
              scanStatus === 'success' ? 'bg-green-50 border border-green-200' :
              scanStatus === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              {/* Icon — hidden in landscape to save space */}
              {scanStatus === 'success' && (
                <div className="w-6 h-6 mobile-landscape:w-4 mobile-landscape:h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 mobile-landscape:w-3 mobile-landscape:h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {scanStatus === 'warning' && (
                <div className="w-6 h-6 mobile-landscape:w-4 mobile-landscape:h-4 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 mobile-landscape:w-3 mobile-landscape:h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              {scanStatus === 'error' && (
                <div className="w-6 h-6 mobile-landscape:w-4 mobile-landscape:h-4 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 mobile-landscape:w-3 mobile-landscape:h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm mobile-landscape:text-xs font-medium truncate ${
                  scanStatus === 'success' ? 'text-green-800' :
                  scanStatus === 'warning' ? 'text-yellow-800' : 'text-red-800'
                }`}>{statusMsg}</p>
              </div>
              <button onClick={resetScan} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Order Info */}
          {orderInfo && (
            <div className="card mb-2 p-3 lg:p-6 mobile-landscape:p-2">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm lg:text-base mobile-landscape:hidden">Informasi Order</h3>

              {/* Info rows — 1 col portrait, 2 col grid landscape */}
              <div className="space-y-1.5 mobile-landscape:space-y-0 mobile-landscape:grid mobile-landscape:grid-cols-2 mobile-landscape:gap-x-4 mobile-landscape:gap-y-1 text-xs mobile-landscape:text-xs">
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">Kode Order</span>
                  <span className="font-mono font-bold text-gray-800">{orderInfo.orderCode}</span>
                </div>
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">Nama Santri</span>
                  <span className="font-medium text-gray-800 truncate">{orderInfo.customer?.nama}</span>
                </div>
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">NIS</span>
                  <span className="font-medium text-gray-800">{orderInfo.customer?.nis}</span>
                </div>
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">No HP</span>
                  <span className="font-medium text-gray-800">{orderInfo.customer?.noHape || '-'}</span>
                </div>
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">Kamar</span>
                  <span className="font-medium text-gray-800">{orderInfo.customer?.kamar}</span>
                </div>
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">Kelas</span>
                  <span className="font-medium text-gray-800">{orderInfo.customer?.kelas}</span>
                </div>
                <div className="flex justify-between mobile-landscape:contents">
                  <span className="text-gray-500">Status</span>
                  <span className="badge bg-indigo-100 text-indigo-800 text-xs">
                    {STAGE_LABELS[orderInfo.status] || orderInfo.status}
                  </span>
                </div>
                {orderInfo.nextStage && (
                  <div className="flex justify-between mobile-landscape:contents">
                    <span className="text-gray-500">Tahap Berikut</span>
                    <span className="badge bg-green-100 text-green-800 text-xs">
                      {STAGE_LABELS[orderInfo.nextStage] || orderInfo.nextStage}
                    </span>
                  </div>
                )}
              </div>

              {orderInfo.nextStage && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5 mobile-landscape:space-y-1">
                  {['WASHING', 'DRYING', 'IRONING'].includes(orderInfo.nextStage!) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        Mesin <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedMachine}
                        onChange={(e) => setSelectedMachine(e.target.value)}
                        className="input-field text-sm mobile-landscape:py-1"
                        required
                      >
                        <option value="">-- Pilih Mesin --</option>
                        {machines
                          .filter((m) => m.category === STAGE_CATEGORY[orderInfo.nextStage!])
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} - {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Catatan <span className="text-gray-400 font-normal">(opsional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="input-field resize-none text-sm mobile-landscape:py-1"
                      rows={2}
                      style={{ lineHeight: '1.4' }}
                      placeholder="Catatan proses..."
                    />
                  </div>

                  {orderInfo.nextStage === 'PICKED_UP' && user?.role === 'OPERATOR' ? (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 text-center">
                      Pengambilan cucian hanya dapat diproses oleh Kasir atau Manager
                    </div>
                  ) : (
                    <button
                      onClick={handleTransition}
                      disabled={submitting || isDuplicate}
                      className="btn-primary w-full py-2 mobile-landscape:py-1.5 flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Memproses...
                        </>
                      ) : (
                        <>Proses ke {STAGE_LABELS[orderInfo.nextStage] || orderInfo.nextStage}</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {!orderInfo.nextStage && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600 text-center">
                  Order ini sudah pada tahap akhir
                </div>
              )}
            </div>
          )}

          {/* Manual Input — hidden when order data found */}
          {!orderInfo && (
            <div className="card p-3 lg:p-6">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm lg:text-base">Input Manual</h3>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Kode order/NIS/No HP..."
                />
                <button type="submit" className="btn-primary whitespace-nowrap">Cari</button>
              </form>
              <p className="text-xs text-gray-400 mt-2">
                Masukkan kode order / NIS / No HP santri jika kamera tidak tersedia
              </p>
            </div>
          )}

        </div>{/* end right column */}
      </div>
    </div>
  );
}
