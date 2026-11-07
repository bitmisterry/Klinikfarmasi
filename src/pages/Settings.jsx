import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Building2, Clock, Printer, Bell, Monitor, Save, Database, Sparkles, AlertTriangle, Tags } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const DEFAULT_SETTINGS = {
  'Profil': [
    { key: 'clinic_name', label: 'Nama Klinik/Apotek', type: 'text', value: 'KlinikFarma' },
    { key: 'clinic_address', label: 'Alamat', type: 'textarea', value: 'Jl. Sudirman No. 1, Jakarta' },
    { key: 'clinic_phone', label: 'Telepon', type: 'text', value: '021-1234567' },
    { key: 'clinic_email', label: 'Email', type: 'text', value: 'info@klinikfarma.id' },
    { key: 'clinic_npwp', label: 'NPWP', type: 'text', value: '' },
    { key: 'clinic_hours', label: 'Jam Operasional', type: 'text', value: '08:00 - 21:00' },
  ],
  'Antrean': [
    { key: 'avg_service_minutes', label: 'Rata-rata Waktu Layanan per Pasien (menit)', type: 'number', value: '10' },
    { key: 'queue_auto_call', label: 'Auto-Panggil Suara di TV Ruang Tunggu', type: 'boolean', value: 'true' },
    { key: 'queue_voice_lang', label: 'Bahasa Suara Panggilan', type: 'select', value: 'id-ID', options: ['id-ID', 'en-US'] },
    { key: 'queue_reset_daily', label: 'Reset Antrean Harian Otomatis', type: 'boolean', value: 'false' },
    { key: 'queue_prefix_format', label: 'Format Prefix Nomor Antrean', type: 'text', value: '{loket}-{seq}' },
  ],
  'Cetak': [
    { key: 'receipt_header', label: 'Header Struk/Nota', type: 'textarea', value: 'KlinikFarma\nJl. Sudirman No. 1, Jakarta\nTelp: 021-1234567' },
    { key: 'receipt_footer', label: 'Footer Struk/Nota', type: 'textarea', value: 'Terima kasih atas kunjungan Anda\nSimpan struk ini sebagai bukti pembayaran' },
    { key: 'receipt_show_logo', label: 'Tampilkan Logo di Struk', type: 'boolean', value: 'false' },
    { key: 'invoice_prefix', label: 'Prefix Nomor Invoice', type: 'text', value: 'INV' },
    { key: 'prescription_prefix', label: 'Prefix Nomor Resep', type: 'text', value: 'R' },
    { key: 'label_facility_name', label: 'Nama Fasilitas untuk Label Racikan', type: 'text', value: 'KlinikFarma' },
  ],
  'Printing': [
    { key: 'prescription_paper_size', label: 'Ukuran Kertas Resep', type: 'select', value: 'A5', options: ['A4', 'A5'] },
    { key: 'label_preset', label: 'Ukuran Label Etiket (Preset)', type: 'select', value: '40x30', options: ['30x20', '40x30', '50x30', '70x40', 'custom'] },
    { key: 'label_custom_w_mm', label: 'Lebar Label Custom (mm)', type: 'number', value: '40' },
    { key: 'label_custom_h_mm', label: 'Tinggi Label Custom (mm)', type: 'number', value: '30' },
    { key: 'clinic_logo_url', label: 'URL Logo Klinik (untuk Resep)', type: 'text', value: '' },
    { key: 'rx_show_weight', label: 'Tampilkan Berat Badan di Resep', type: 'boolean', value: 'true' },
    { key: 'rx_show_age', label: 'Tampilkan Umur di Resep', type: 'boolean', value: 'true' },
    { key: 'rx_show_sip', label: 'Tampilkan SIP Dokter di Resep', type: 'boolean', value: 'true' },
    { key: 'rx_show_allergy', label: 'Tampilkan Alergi di Resep', type: 'boolean', value: 'true' },
    { key: 'rx_show_mr', label: 'Tampilkan No. RM di Resep', type: 'boolean', value: 'true' },
    { key: 'label_show_doctor', label: 'Tampilkan Nama Dokter di Etiket', type: 'boolean', value: 'true' },
    { key: 'label_show_rx_number', label: 'Tampilkan No. Resep di Etiket', type: 'boolean', value: 'true' },
    { key: 'label_show_storage_note', label: 'Tampilkan Catatan Penyimpanan di Etiket', type: 'boolean', value: 'true' },
    { key: 'label_show_pio', label: 'Tampilkan Info PIO di Etiket', type: 'boolean', value: 'false' },
  ],
  'Notifikasi': [
    { key: 'notif_low_stock', label: 'Notifikasi Stok Rendah', type: 'boolean', value: 'true' },
    { key: 'notif_anomaly', label: 'Notifikasi Anomali (Anti-Blind-Spot)', type: 'boolean', value: 'true' },
    { key: 'notif_prescription', label: 'Notifikasi Resep Baru', type: 'boolean', value: 'true' },
    { key: 'notif_pengadaan', label: 'Notifikasi Permintaan Pengadaan', type: 'boolean', value: 'true' },
    { key: 'notif_expiry', label: 'Notifikasi Obat Mendekati Kadaluarsa', type: 'boolean', value: 'true' },
  ],
  'Tampilan': [
    { key: 'tv_display_name', label: 'Nama di Layar TV Ruang Tunggu', type: 'text', value: 'KlinikFarma' },
    { key: 'tv_show_est_wait', label: 'Tampilkan Estimasi Tunggu di TV', type: 'boolean', value: 'true' },
    { key: 'tv_auto_refresh', label: 'Interval Auto-Refresh TV (detik)', type: 'number', value: '3' },
    { key: 'tv_font_scale', label: 'Skala Font TV (1=normal, 1.5=besar)', type: 'text', value: '1' },
  ],
  'Penentuan Harga': [
    { key: 'hpp_method', label: 'Metode HPP', type: 'select', value: 'Per Batch FEFO', options: ['Per Batch FEFO', 'Rata-rata Tertimbang', 'FIFO'] },
    { key: 'bonus_treatment_default', label: 'Perlakuan Bonus (default)', type: 'select', value: 'Per Faktur', options: ['Per Faktur', 'Prorata'] },
    { key: 'ppn_in_hpp', label: 'PPN masuk dalam HPP', type: 'boolean', value: 'true' },
    { key: 'default_target_margin', label: 'Target Margin Default (%)', type: 'number', value: '30' },
    { key: 'price_rounding', label: 'Pembulatan Harga (Rp)', type: 'number', value: '500' },
    { key: 'override_roles', label: 'Role yang Boleh Override Harga Minimum', type: 'text', value: 'Owner,Admin' },
  ],
};

const TABS = [
  { k: 'Profil', l: 'Profil Klinik', icon: Building2 },
  { k: 'Antrean', l: 'Antrean & Panggilan', icon: Clock },
  { k: 'Cetak', l: 'Cetak & Label', icon: Printer },
  { k: 'Printing', l: 'Printer Config', icon: Printer },
  { k: 'Notifikasi', l: 'Notifikasi', icon: Bell },
  { k: 'Tampilan', l: 'Tampilan & TV', icon: Monitor },
  { k: 'Penentuan Harga', l: 'Penentuan Harga', icon: Tags },
  { k: 'Data', l: 'Data & Demo', icon: Database },
];

export default function Settings() {
  const [tab, setTab] = useState('Profil');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const isAdmin = user?.role === 'admin';

  const runSeed = async () => {
    setShowSeedConfirm(false);
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await base44.functions.invoke('seedAllDemoData', {});
      const data = res.data || res;
      setSeedResult(data);
      toast({
        title: 'Seed Demo Data selesai',
        description: `${data.total || 0} record dibuat di ${Object.keys(data.counts || {}).length} entity`,
      });
    } catch (e) {
      toast({ title: 'Gagal seed data', description: e.message, variant: 'destructive' });
    }
    setSeeding(false);
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const records = await base44.entities.ClinicSetting.list() || [];
      const map = {};
      records.forEach(r => { map[r.key] = r; });
      setSettings(map);
    } catch {}
    setLoading(false);
  };

  const getValue = (key, defaultVal) => settings[key]?.value ?? defaultVal;

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), value: String(value) },
    }));
  };

  const saveTab = async () => {
    setSaving(true);
    try {
      const defaults = DEFAULT_SETTINGS[tab];
      for (const def of defaults) {
        const existing = settings[def.key];
        const value = getValue(def.key, def.value);
        if (existing) {
          await base44.entities.ClinicSetting.update(existing.id, { value: String(value) });
        } else {
          await base44.entities.ClinicSetting.create({
            key: def.key, value: String(value),
            category: tab, label: def.label, type: def.type,
          });
        }
      }
      await base44.entities.AuditLog.create({
        action: 'update', entity: 'ClinicSetting',
        description: `Update pengaturan ${tab}`,
        user_name: 'Admin', timestamp: new Date().toISOString(),
      });
      toast({ title: 'Pengaturan tersimpan', description: `Kategori ${tab} diperbarui` });
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const renderField = (def) => {
    const value = getValue(def.key, def.value);
    const inputCls = "w-full px-2 py-1.5 border border-border rounded text-xs outline-none focus:border-primary bg-card";
    if (def.type === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={value === 'true'} onChange={e => handleChange(def.key, e.target.checked)} className="w-4 h-4" />
          <span className="text-xs text-muted-foreground">{value === 'true' ? 'Aktif' : 'Nonaktif'}</span>
        </div>
      );
    }
    if (def.type === 'textarea') return <textarea value={value} onChange={e => handleChange(def.key, e.target.value)} className={inputCls} rows={3} />;
    if (def.type === 'number') return <input type="number" value={value} onChange={e => handleChange(def.key, e.target.value)} className={inputCls} />;
    if (def.type === 'select') return (
      <select value={value} onChange={e => handleChange(def.key, e.target.value)} className={inputCls}>
        {def.options.map(o => <option key={o}>{o}</option>)}
      </select>
    );
    return <input value={value} onChange={e => handleChange(def.key, e.target.value)} className={inputCls} />;
  };

  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div>
        <h1 className="text-lg font-medium flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary" /> Pengaturan & Konfigurasi
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Kelola profil klinik, antrean, cetak, notifikasi, dan tampilan sistem.</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.l}
          </button>
        ))}
      </div>

      {tab !== 'Data' && (
      <div className="panel">
        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{TABS.find(t => t.k === tab)?.l}</h2>
          <button onClick={saveTab} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded text-xs font-medium disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>
        </div>
        <div className="p-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground text-center py-4">Memuat…</p>}
          {!loading && DEFAULT_SETTINGS[tab].map(def => (
            <div key={def.key} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 md:gap-3 items-start">
              <label className="text-xs font-medium text-muted-foreground pt-1.5">{def.label}</label>
              <div>{renderField(def)}</div>
            </div>
          ))}
        </div>
        <div className="px-3 py-2.5 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground">
            Perubahan disimpan ke database dan berlaku sistem-wide. Pengaturan antrean & TV langsung memengaruhi estimasi waktu tunggu dan tampilan layar.
          </p>
        </div>
      </div>
      )}

      {tab === 'Data' && (
        <div className="panel">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Data & Demo</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="panel-accent px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <Database className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Seed Demo Data</p>
                  <p className="text-caption mt-1">
                    Isi seluruh modul dengan data dummy lengkap (10+ record per entity) — Pasien, Antrean, Rekam Medis, Resep, Transaksi, Inventory, Purchasing, Finance, HR, Jadwal, Portal Dokter, dan Portal Pasien. Tanggal tersebar di 7 hari terakhir + hari ini agar dashboard "Hari Ini" selalu menampilkan data.
                  </p>
                  <p className="text-caption mt-1.5 text-muted-foreground">
                    Data ditandai prefix <code className="text-[11px] bg-muted px-1 rounded">DEMO-</code> agar idempotent — klik ulang aman, tidak menduplikasi.
                  </p>
                </div>
              </div>
            </div>

            {!isAdmin ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Hanya admin/owner yang dapat menjalankan seed data.
              </div>
            ) : (
              <button
                onClick={() => setShowSeedConfirm(true)}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2.5 btn-primary rounded text-sm font-medium disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                {seeding ? 'Menjalankan seed…' : 'Seed Demo Data Sekarang'}
              </button>
            )}

            {seeding && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                Menyisipkan data demo ke seluruh entity…
              </div>
            )}

            {seedResult && !seeding && (
              <div className="panel">
                <div className="px-3 py-2.5 border-b border-border">
                  <h3 className="text-sm font-semibold text-emerald-700">✓ Seed selesai — {seedResult.total} record dibuat</h3>
                </div>
                <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {Object.entries(seedResult.counts || {}).map(([entity, count]) => (
                    <div key={entity} className="flex justify-between text-xs px-2 py-1 bg-muted/30 rounded">
                      <span className="text-muted-foreground">{entity}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSeedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSeedConfirm(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Konfirmasi Seed Demo Data</h2>
              <button onClick={() => setShowSeedConfirm(false)} className="p-1 hover:bg-muted rounded text-muted-foreground">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm">
                Sistem akan mengisi data dummy lengkap ke seluruh modul (Pasien, Antrean, Rekam Medis, Resep, Transaksi, Inventory, Purchasing, Finance, HR, Jadwal, Portal Dokter/Pasien).
              </p>
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Proses ini menambahkan record baru (tidak menghapus data lama). Data ditandai prefix <code className="bg-amber-100 px-1 rounded">DEMO-</code> agar idempotent.</span>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowSeedConfirm(false)} className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted">Batal</button>
                <button onClick={runSeed} className="px-3 py-1.5 btn-primary rounded text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Ya, Seed Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
