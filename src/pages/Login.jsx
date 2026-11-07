const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";
import { Link } from "react-router-dom";

import { Mail, Lock, Loader2, Eye, EyeOff, Stethoscope, Pill, Activity, ShieldCheck, Clock, Wallet, Sparkles, Info, Baby, HeartPulse, Bone, UserCheck, Building2, ClipboardCheck } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tab, setTab] = useState("login");
  const [pin, setPin] = useState("");
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await db.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Email atau password salah");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => db.auth.loginWithProvider("google", returnTo);

  const DEMO_ACCOUNTS = [
    { role: 'Owner', email: 'demo.owner@klinikfarma.com', password: 'Demo1234!', icon: ShieldCheck, color: 'text-purple-600 bg-purple-50' },
    { role: 'Dokter Umum', email: 'demo.dokterumum@klinikfarma.com', password: 'Demo1234!', icon: Stethoscope, color: 'text-blue-600 bg-blue-50' },
    { role: 'Dokter Spesialis Anak', email: 'demo.dokteranak@klinikfarma.com', password: 'Demo1234!', icon: Baby, color: 'text-emerald-600 bg-emerald-50' },
    { role: 'Dokter Spesialis Penyakit Dalam', email: 'demo.dokterdalam@klinikfarma.com', password: 'Demo1234!', icon: HeartPulse, color: 'text-purple-600 bg-purple-50' },
    { role: 'Dokter Gigi', email: 'demo.doktergigi@klinikfarma.com', password: 'Demo1234!', icon: Bone, color: 'text-teal-600 bg-teal-50' },
    { role: 'Dokter Locum', email: 'demo.dokterlocum@klinikfarma.com', password: 'Demo1234!', icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
    { role: 'Apoteker', email: 'demo.apoteker@klinikfarma.com', password: 'Demo1234!', icon: Pill, color: 'text-teal-600 bg-teal-50' },
    { role: 'Apoteker Penanggung Jawab', email: 'demo.apj@klinikfarma.com', password: 'Demo1234!', icon: ShieldCheck, color: 'text-emerald-700 bg-emerald-50' },
    { role: 'Apoteker Pendamping', email: 'demo.apotekerpendamping@klinikfarma.com', password: 'Demo1234!', icon: Pill, color: 'text-cyan-700 bg-cyan-50' },
    { role: 'Admin Farmasi', email: 'demo.adminfarmasi@klinikfarma.com', password: 'Demo1234!', icon: ClipboardCheck, color: 'text-slate-700 bg-slate-50' },
    { role: 'Kasir', email: 'demo.kasir@klinikfarma.com', password: 'Demo1234!', icon: Wallet, color: 'text-emerald-600 bg-emerald-50' },
    { role: 'Perawat', email: 'demo.perawat@klinikfarma.com', password: 'Demo1234!', icon: Activity, color: 'text-rose-600 bg-rose-50' },
    { role: 'Front Office', email: 'demo.frontoffice@klinikfarma.com', password: 'Demo1234!', icon: Building2, color: 'text-slate-600 bg-slate-50' },
    { role: 'Finance', email: 'demo.finance@klinikfarma.com', password: 'Demo1234!', icon: Wallet, color: 'text-amber-700 bg-amber-50' },
    { role: 'TTK/Asisten Farmasi', email: 'demo.ttk@klinikfarma.com', password: 'Demo1234!', icon: Pill, color: 'text-cyan-700 bg-cyan-50' },
    { role: 'Asisten Dokter', email: 'demo.asistendokter@klinikfarma.com', password: 'Demo1234!', icon: Activity, color: 'text-rose-700 bg-rose-50' },
    { role: 'Pasien', email: 'demo.pasien@klinikfarma.com', password: 'Demo1234!', icon: UserCheck, color: 'text-slate-700 bg-slate-50' },
    { role: 'Manajer Operasional', email: 'demo.opsmanager@klinikfarma.com', password: 'Demo1234!', icon: ClipboardCheck, color: 'text-indigo-600 bg-indigo-50' },
  ];

  const DOCTOR_DEMO_ROLES = ['Dokter Umum', 'Dokter Spesialis Anak', 'Dokter Spesialis Penyakit Dalam', 'Dokter Gigi', 'Dokter Locum'];

  const loginAs = async (role, email) => {
    const isDoctorDemo = DOCTOR_DEMO_ROLES.includes(role);
    setError("");
    setLoading(true);
    try {
      // Keep the local demo identity and its per-tab session marker in sync.
      // This prevents a previous logout from rejecting subsequent mutations.
      if (typeof db.auth.loginAsDemoRole === 'function') {
        await db.auth.loginAsDemoRole({ role, email });
      } else {
        throw new Error('Adapter sesi lokal tidak tersedia. Muat ulang aplikasi lalu coba lagi.');
      }
      window.location.href = isDoctorDemo ? '/doctor' : returnTo;
    } catch (err) {
      setError(err.message || "Gagal memulai sesi demo");
      setLoading(false);
    }
  };

  const todayStr = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left — Brand & Clinic Info */}
      <div className="lg:w-[40%] bg-gradient-to-br from-primary to-primary-hover text-primary-foreground flex flex-col justify-between p-6 lg:p-10 lg:py-12 relative overflow-hidden">
        {/* Subtle abstract medical pattern */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
          <div className="absolute top-10 right-10 w-40 h-40 rounded-full border-[12px] border-white" />
          <div className="absolute bottom-20 left-10 w-28 h-28 rounded-full border-[8px] border-white" />
          <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full border-[6px] border-white" />
        </div>

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">KlinikFarma</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-bold leading-tight mb-2">
            Clinic &amp; Pharmacy<br />Management System
          </h1>
          <p className="text-sm opacity-85 max-w-xs leading-relaxed mb-8">
            Pelayanan klinik, praktik dokter &amp; instalasi farmasi dalam satu sistem.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: Stethoscope, label: "Klinik", desc: "Pemeriksaan, RME, antrean" },
              { icon: Pill, label: "Apotek", desc: "Dispensing, stok, racikan" },
              { icon: ShieldCheck, label: "Satu Sistem", desc: "Terintegrasi & aman" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-[11px] opacity-75">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="relative mt-8 lg:mt-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-xs font-medium">Sistem Aktif</span>
          </div>
          <p className="text-[11px] opacity-80">{todayStr}</p>
          <p className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Jam operasional: 08.00 – 21.00 WIB
          </p>
        </div>

        {/* Footer */}
        <div className="relative mt-6 pt-4 border-t border-white/15 flex items-center gap-3 text-[10px] opacity-70">
          <span>v1.0.0</span><span>•</span>
          <span>Bantuan</span><span>•</span>
          <span>Kebijakan Privasi</span><span>•</span>
          <span>Hubungi Kami</span>
        </div>
      </div>

      {/* Right — Access Area */}
      <div className="lg:w-[60%] flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Selamat Datang</h2>
            <p className="text-sm text-muted-foreground mt-1">Masuk untuk melanjutkan aktivitas Anda.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-border">
            <button
              onClick={() => setTab("login")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "login" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setTab("pin")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === "pin" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              PIN Cepat
            </button>
          </div>

          {error && (
            <div className="mb-4 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs">{error}</div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Email / Username / ID Pegawai</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    autoFocus
                    placeholder="nama@klinik.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 border border-border rounded-lg text-sm bg-card outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 border border-border rounded-lg text-sm bg-card outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-3.5 h-3.5 rounded border-border accent-primary" />
                  Ingat saya
                </label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Lupa password?</Link>
              </div>
              <button type="submit" disabled={loading} className="w-full h-11 btn-primary rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses…</> : "Masuk"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Kode PIN (6 digit)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-11 px-3 border border-border rounded-lg text-sm bg-card outline-none focus:border-primary text-center tracking-[0.5em] font-mono text-lg"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> PIN cepat untuk workstation internal — hubungi admin untuk mengaktifkan
                </p>
              </div>
              <button disabled className="w-full h-11 btn-primary rounded-lg text-sm font-semibold opacity-50 cursor-not-allowed">
                Masuk dengan PIN
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">atau</span></div>
          </div>

          {/* Google */}
          <button onClick={handleGoogle} className="w-full h-11 border border-border rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors">
            <GoogleIcon className="w-4 h-4" /> Masuk dengan Google
          </button>

          {/* Register link */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Belum punya akun?{" "}
            <Link to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")} className="text-primary font-medium hover:underline">
              Daftar di sini
            </Link>
          </p>

          {/* Demo Accounts */}
          <div className="mt-6 pt-4 border-t border-dashed border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-medium">Akun Demo — Coba Tiap Peran</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DEMO_ACCOUNTS.map(d => (
                <button key={d.role} onClick={() => loginAs(d.role, d.email)} disabled={loading}
                  className="flex flex-col items-center gap-1 p-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
                  <div className={`w-7 h-7 rounded-full ${d.color} flex items-center justify-center`}>
                    <d.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-medium">{d.role}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-start gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              Klik peran untuk login otomatis. Password semua akun demo: <strong className="font-mono">Demo1234!</strong>
            </p>
          </div>

          {/* Quote */}
          <p className="text-center text-[11px] text-muted-foreground italic mt-6 px-4 leading-relaxed">
            "Pelayanan kesehatan yang lebih baik dimulai dari sistem yang lebih baik."
          </p>
        </div>
      </div>
    </div>
  );
}
