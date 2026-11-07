const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Search, Bone as Tooth, Save, History, Baby } from 'lucide-react';
import ModuleStatHeader from '@/components/ModuleStatHeader';
import EmptyState from '@/components/EmptyState';
import OdontogramChart from '@/components/odontogram/OdontogramChart';
import TreatmentPlanPanel from '@/components/odontogram/TreatmentPlanPanel';
import { TOOTH_CONDITIONS, TOOTH_SURFACES, getToothInfo } from '@/lib/odontogram';

export default function Odontogram() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [isChild, setIsChild] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [condition, setCondition] = useState('Karies');
  const [surfaces, setSurfaces] = useState([]);
  const [notes, setNotes] = useState('');
  const requestedPatientId = searchParams.get('patient');
  const visitId = searchParams.get('visit') || '';

  useEffect(() => {
    db.entities.Patient.list().then(p => {
      const patientList = p || [];
      setPatients(patientList);
      if (requestedPatientId) {
        setSelectedPatient(patientList.find((patient) => patient.id === requestedPatientId) || null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [requestedPatientId]);

  useEffect(() => {
    if (!selectedPatient) return;
    db.entities.OdontogramRecord.filter({ patient_id: selectedPatient.id }).then(r => setRecords(r || [])).catch(() => setRecords([]));
    db.entities.TreatmentPlan.filter({ patient_id: selectedPatient.id }).then(p => setPlans(p || [])).catch(() => setPlans([]));
  }, [selectedPatient]);

  const filteredPatients = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const activePlan = plans.find(p => p.status === 'Aktif') || plans[0];

  const handleToothClick = (toothNumber) => {
    setSelectedTooth(toothNumber);
    const existing = records.find(r => r.tooth_number === toothNumber);
    if (existing) {
      setCondition(existing.condition);
      setSurfaces(existing.surfaces || []);
      setNotes(existing.notes || '');
    } else {
      setCondition('Karies');
      setSurfaces([]);
      setNotes('');
    }
  };

  const saveToothRecord = async () => {
    if (!selectedPatient || !selectedTooth) return;
    const toothInfo = getToothInfo(selectedTooth);
    const existing = records.find(r => r.tooth_number === selectedTooth);
    try {
      if (existing) {
        await db.entities.OdontogramRecord.update(existing.id, {
          condition,
          surfaces,
          notes,
          treatment_date: new Date().toISOString().split('T')[0],
          doctor_id: user?.id,
          doctor_name: user?.full_name,
        });
      } else {
        await db.entities.OdontogramRecord.create({
          patient_id: selectedPatient.id,
          patient_name: selectedPatient.full_name,
          visit_id: visitId,
          tooth_number: selectedTooth,
          tooth_type: toothInfo?.type || 'Molar',
          arch: selectedTooth.startsWith('1') || selectedTooth.startsWith('2') || selectedTooth.startsWith('5') || selectedTooth.startsWith('6') ? 'Upper' : 'Lower',
          is_primary: selectedTooth.startsWith('5') || selectedTooth.startsWith('6') || selectedTooth.startsWith('7') || selectedTooth.startsWith('8'),
          condition,
          surfaces,
          treatment_date: new Date().toISOString().split('T')[0],
          doctor_id: user?.id,
          doctor_name: user?.full_name,
          treatment_plan_id: activePlan?.id,
          notes,
        });
      }
      toast({ title: `Gigi ${selectedTooth} tersimpan`, description: TOOTH_CONDITIONS[condition].label });
      const updated = await db.entities.OdontogramRecord.filter({ patient_id: selectedPatient.id });
      setRecords(updated || []);
      setSelectedTooth(null);
    } catch (e) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    }
  };

  const toggleSurface = (s) => {
    setSurfaces(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const stats = [
    { label: 'Total Gigi', value: isChild ? '20' : '32', icon: Tooth, color: 'text-primary' },
    { label: 'Tercatat', value: records.length, icon: Save, color: 'text-blue-500' },
    { label: 'Karies', value: records.filter(r => r.condition === 'Karies').length, icon: Tooth, color: 'text-rose-500' },
    { label: 'Tambal', value: records.filter(r => r.condition === 'Tambal').length, icon: Tooth, color: 'text-blue-500' },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Tooth className="w-5 h-5 text-primary" /> Odontogram
          </h1>
          <p className="text-xs text-muted-foreground">Pencatatan kondisi gigi & rencana perawatan bertahap</p>
        </div>
        <button
          onClick={() => setIsChild(!isChild)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border ${isChild ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
        >
          <Baby className="w-3.5 h-3.5" /> {isChild ? 'Gigi Susu' : 'Gigi Tetap'}
        </button>
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
              placeholder="Cari pasien…"
              className="flex-1 bg-transparent outline-none text-xs"
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-0.5">
            {loading && <p className="text-xs text-muted-foreground text-center py-4">Memuat…</p>}
            {!loading && filteredPatients.length === 0 && (
              <EmptyState icon={Search} title="Tidak ada pasien" description="Cari nama pasien" />
            )}
            {filteredPatients.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                  selectedPatient?.id === p.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <p className="font-medium truncate">{p.full_name}</p>
                <p className={`text-[10px] ${selectedPatient?.id === p.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {p.mr_number} • {p.gender === 'L' ? 'L' : 'P'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Odontogram + Tooth Editor */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPatient ? (
            <>
              <OdontogramChart
                records={records}
                onToothClick={handleToothClick}
                selectedTooth={selectedTooth}
                isChild={isChild}
              />

              {selectedTooth && (
                <div className="panel p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Gigi {selectedTooth} — {getToothInfo(selectedTooth)?.name || ''}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="micro-label mb-1.5">Kondisi</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(TOOTH_CONDITIONS).map(([key, info]) => (
                          <button
                            key={key}
                            onClick={() => setCondition(key)}
                            className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md border transition-all ${
                              condition === key ? 'ring-2 ring-primary border-primary' : 'border-border hover:bg-muted'
                            }`}
                          >
                            <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: info.color, borderColor: info.border }} />
                            {info.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="micro-label mb-1.5">Permukaan Terdampak</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TOOTH_SURFACES.map(s => (
                          <button
                            key={s}
                            onClick={() => toggleSurface(s)}
                            className={`text-xs px-2 py-1 rounded-md border ${
                              surfaces.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Catatan tindakan…"
                      className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card min-h-16"
                    />

                    <div className="flex gap-2">
                      <button onClick={saveToothRecord} className="btn-primary text-xs px-4 py-1.5 rounded">Simpan</button>
                      <button onClick={() => setSelectedTooth(null)} className="text-xs px-4 py-1.5 rounded border border-border">Batal</button>
                    </div>
                  </div>
                </div>
              )}

              <TreatmentPlanPanel patient={selectedPatient} plan={activePlan} onRefresh={() => {
                db.entities.TreatmentPlan.filter({ patient_id: selectedPatient.id }).then(p => setPlans(p || []));
              }} doctor={user} />

              <div className="panel p-4">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 text-sm font-semibold mb-2"
                >
                  <History className="w-4 h-4 text-primary" /> Riwayat Pencatatan
                </button>
                {showHistory && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {records.length === 0 && <p className="text-xs text-muted-foreground">Belum ada pencatatan.</p>}
                    {records.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-muted/30 rounded">
                        <span className="font-mono font-medium w-8">{r.tooth_number}</span>
                        <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: TOOTH_CONDITIONS[r.condition]?.color, borderColor: TOOTH_CONDITIONS[r.condition]?.border }} />
                        <span className="flex-1">{TOOTH_CONDITIONS[r.condition]?.label}</span>
                        <span className="text-muted-foreground">{r.treatment_date}</span>
                        <span className="text-muted-foreground">{r.doctor_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState icon={Tooth} title="Pilih Pasien" description="Pilih pasien dari daftar untuk mulai mencatat kondisi gigi." />
          )}
        </div>
      </div>
    </div>
  );
}
