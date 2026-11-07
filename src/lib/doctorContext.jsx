const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { createContext, useContext, useState, useEffect } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';

const DoctorContext = createContext(null);

export function isDoctorRole(clinicRole) {
  if (!clinicRole) return false;
  return clinicRole.startsWith('Dokter');
}

export function DoctorContextProvider({ children }) {
  const { user } = useAuth();
  const [context, setContext] = useState({
    loading: true,
    isAssistant: false,
    isDoctor: false,
    doctorUserId: null,
    doctorProfile: null,
    assistantRecord: null,
  });

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        // Check if user is an assistant by user_id first, then by email
        let assistants = await db.entities.DoctorAssistant.filter({ assistant_user_id: user.id }).catch(() => []);
        if (!assistants || assistants.length === 0) {
          assistants = await db.entities.DoctorAssistant.filter({ assistant_email: user.email }).catch(() => []);
        }
        const assistantRecord = (assistants || [])[0];

        if (assistantRecord && assistantRecord.is_active !== false) {
          // Link user_id if not yet set
          if (!assistantRecord.assistant_user_id) {
            try {
              await db.entities.DoctorAssistant.update(assistantRecord.id, { assistant_user_id: user.id });
            } catch {}
          }

          // Load doctor profile
          let doctorProfile = null;
          if (assistantRecord.doctor_profile_id) {
            try { doctorProfile = await db.entities.DoctorProfile.get(assistantRecord.doctor_profile_id); } catch {}
          }
          if (!doctorProfile && assistantRecord.doctor_user_id) {
            try {
              const profiles = await db.entities.DoctorProfile.filter({ user_id: assistantRecord.doctor_user_id });
              doctorProfile = (profiles || [])[0];
            } catch {}
          }

          setContext({
            loading: false,
            isAssistant: true,
            isDoctor: false,
            doctorUserId: assistantRecord.doctor_user_id,
            doctorProfile,
            assistantRecord,
          });
          return;
        }

        // Not an assistant — check if doctor
        const clinicRole = getClinicRole(user);
        const isDoc = isDoctorRole(clinicRole);

        let doctorProfile = null;
        try {
          const profiles = await db.entities.DoctorProfile.filter({ user_id: user.id });
          doctorProfile = (profiles || [])[0];
        } catch {}

        setContext({
          loading: false,
          isAssistant: false,
          isDoctor: isDoc || !!doctorProfile,
          doctorUserId: user.id,
          doctorProfile,
          assistantRecord: null,
        });
      } catch (e) {
        console.error('doctorContext error:', e);
        setContext({
          loading: false,
          isAssistant: false,
          isDoctor: false,
          doctorUserId: user.id,
          doctorProfile: null,
          assistantRecord: null,
        });
      }
    })();
  }, [user?.id, user?.email]);

  return (
    <DoctorContext.Provider value={context}>
      {children}
    </DoctorContext.Provider>
  );
}

export function useDoctorContext() {
  const ctx = useContext(DoctorContext);
  if (!ctx) {
    throw new Error('useDoctorContext must be used within DoctorContextProvider');
  }
  return ctx;
}