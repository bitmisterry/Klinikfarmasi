// @ts-nocheck -- Pediatric measurements use age-dependent dynamic schemas.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Search, Baby, Scale, Ruler, Save } from 'lucide-react';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import GrowthChartView from '@/components/pediatric/GrowthChartView';
import ImmunizationCard from '@/components/pediatric/ImmunizationCard';
import { calculateGrowth } from '@/lib/growthChart';
import { getAgeInMonths, getAgeLabel } from '@/lib/immunization';

export default function GrowthChart() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState([]);
  const [familyAccounts, setFamilyAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [growthRecords, setGrowthRecords] = useState([]);
  const [immunizationRecords, setImmunizationRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [measureForm, setMeasureForm] = useState({ weight: '', height: '', head_circumference: '' });
  const requestedPatientId = searchParams.get('patient');
  const visitId = searchParams.get('visit') || '';

  useEffect(() => {
    Promise.all([
      db.entities.Patient.list(),
      db.entities.FamilyAccount.list(),
    ]).then(([p, families]) => {
      setFamilyAccounts(families || []);
      const linkedPatientIds = new Set((families || []).flatMap((family) => [
        ...(family.member_patient_ids || []),
        ...(family.child_patient_ids || []),
      ]));
      // Filter children (under 18)
      const now = new Date();
      const children = (p || []).filter(pt => {
        if (!pt.birth_date) return false;
        const birth = new Date(pt.birth_date);
        const ageYears = (now - birth) / (365.25 * 24 * 60 * 60 * 1000);
        return ageYears < 18 && linkedPatientIds.has(pt.id);
      });
      setPatients(children);
      if (requestedPatientId) {
        setSelectedPatient(children.find((patient) => patient.id === requestedPatientId) || null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [requestedPatientId]);

  useEffect(() => {
    if (!selectedPatient) return;
    db.entities.GrowthRecord.filter({ patient_id: selectedPatient.id }).then(r => {
      setGrowthRecords((r || []).sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)));
    }).catch(() => setGrowthRecords([]));
    db.entities.ImmunizationRecord.filter({ patient_id: selectedPatient.id }).then(r => {
      setImmunizationRecords(r || []);
    }).catch(() => setImmunizationRecords([]));
  }, [selectedPatient]);

  const filteredPatients = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const ageMonths = selectedPatient?.birth_date ? getAgeInMonths(selectedPatient.birth_date) : 0;
  const selectedFamily = familyAccounts.find((family) => [
    ...(family.member_patient_ids || []),
    ...(family.child_patient_ids || []),
  ].includes(selectedPatient?.id));

  const saveMeasurement = async () => {
    if (!selectedPatient) return;
    const weight = Number(measureForm.weight);
    const height = Number(measureForm.height);
    if (!weight || !height) {
      toast({ title: 'Berat & tinggi wajib diisi', variant: 'destructive' });
      return;
    }
    const growth = calculateGrowth(selectedPatient.gender, ageMonths, weight, height);
    try {
      await db.entities.GrowthRecord.create({
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.full_name,
        visit_id: visitId,
        visit_date: new Date().toISOString().split('T')[0],
        age_months: ageMonths,
        gender: selectedPatient.gender,
        weight,
        height,
        head_circumference: Number(measureForm.head_circumference) || undefined,
        ...growth,
        doctor_id: user?.id,
        doctor_name: user?.full_name,
      });
      toast({ title: 'Pengukuran tersimpan', description: `Status gizi: ${growth.nutrition_status}` });
      setMeasureForm({ weight: '', height: '', head_circumference: '' });
      const updated = await db.entities.GrowthRecord.filter({ patient_id: selectedPatient.id });
      setGrowthRecords((updated || []).sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)));
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const stats = [
    { label: 'Pasien Anak', value: patients.length, icon: Baby, color: 'text-primary' },
    { label: 'Pengukuran', value: growthRecords.length, icon: Scale, color: 'text-blue-500' },
    { label: 'Usia Pasien', value: selectedPatient ? getAgeLabel(ageMonths) : '-', icon: Baby, color: 'text-emerald-500' },
    { label: 'Status Gizi', value: growthRecords[0]?.nutrition_status || '-', icon: Ruler, color: growthRecords[0]?.nutrition_status === 'Normal' ? 'text-emerald-500' : 'text-amber-500' },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Baby className="w-5 h-5 text-primary" /> Tumbuh Kembang & Imunisasi
        </h1>
        <p className="text-xs text-muted-foreground">Pemantauan pertumbuhan anak (WHO standards) & kartu imunisasi digital</p>
      </div>

      <ModuleStatHeader stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Patient List */}
        <div className="panel p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari pasien anak…"
              className="flex-1 bg-transparent outline-none text-xs"
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-0.5">
            {loading && <p className="text-xs text-muted-foreground text-center py-4">Memuat…</p>}
            {!loading && filteredPatients.length === 0 && (
              <EmptyState icon={Baby} title="Tidak ada pasien anak terhubung" description="Pasien harus berusia < 18 tahun, ditugaskan kepada dokter ini, dan terhubung ke akun orang tua/wali." />
            )}
            {filteredPatients.map(p => {
              const age = getAgeInMonths(p.birth_date);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                    selectedPatient?.id === p.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <p className="font-medium truncate">{p.full_name}</p>
                  <p className={`text-[10px] ${selectedPatient?.id === p.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {getAgeLabel(age)} • {p.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Growth Chart + Immunization */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPatient ? (
            <>
              {/* Measurement Input */}
              <div className="panel p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Save className="w-4 h-4 text-primary" /> Input Pengukuran Baru
                </h3>
                <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                  Akun keluarga: <span className="font-semibold">{selectedFamily?.family_name || '-'}</span> • Wali: {selectedFamily?.parent_name || selectedPatient.guardian_name || '-'} ({selectedFamily?.parent_relation || selectedPatient.guardian_relation || 'Wali'})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="micro-label mb-1">Berat (kg)</p>
                    <input
                      type="number"
                      step="0.1"
                      value={measureForm.weight}
                      onChange={e => setMeasureForm({ ...measureForm, weight: e.target.value })}
                      placeholder="mis. 8.5"
                      className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
                    />
                  </div>
                  <div>
                    <p className="micro-label mb-1">Tinggi (cm)</p>
                    <input
                      type="number"
                      step="0.1"
                      value={measureForm.height}
                      onChange={e => setMeasureForm({ ...measureForm, height: e.target.value })}
                      placeholder="mis. 72"
                      className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
                    />
                  </div>
                  <div>
                    <p className="micro-label mb-1">Lingkar Kepala (cm)</p>
                    <input
                      type="number"
                      step="0.1"
                      value={measureForm.head_circumference}
                      onChange={e => setMeasureForm({ ...measureForm, head_circumference: e.target.value })}
                      placeholder="opsional"
                      className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card"
                    />
                  </div>
                </div>
                <button onClick={saveMeasurement} className="btn-primary text-xs px-4 py-1.5 rounded mt-3">
                  Simpan Pengukuran
                </button>
              </div>

              <GrowthChartView patient={selectedPatient} records={growthRecords} />
              <ImmunizationCard patient={selectedPatient} records={immunizationRecords} onRefresh={() => {
                db.entities.ImmunizationRecord.filter({ patient_id: selectedPatient.id }).then(r => setImmunizationRecords(r || []));
              }} doctor={user} />
            </>
          ) : (
            <EmptyState icon={Baby} title="Pilih Pasien Anak" description="Pilih pasien dari daftar untuk memantau pertumbuhan dan imunisasi." />
          )}
        </div>
      </div>
    </div>
  );
}
