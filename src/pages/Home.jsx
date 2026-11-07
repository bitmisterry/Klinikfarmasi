import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClinicRole } from '@/lib/roles';
import PharmacistHome from '@/components/home/PharmacistHome';
import OwnerHome from '@/components/home/OwnerHome';
import KasirHome from '@/components/home/KasirHome';
import FrontDeskHome from '@/components/home/FrontDeskHome';
import FinanceHome from '@/components/home/FinanceHome';
import DefaultHome from '@/components/home/DefaultHome';
import NurseHome from '@/components/home/NurseHome';
import OpsManager from '@/pages/OpsManager';

export default function Home() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const role = getClinicRole(user);

  // Doctors go to the Doctor Portal (all roles starting with 'Dokter')
  if (role.startsWith('Dokter')) {
    return <Navigate to="/doctor" replace />;
  }
  // Asisten Dokter goes to assistant dashboard
  if (role === 'Asisten Dokter') {
    return <Navigate to="/doctor/assistant" replace />;
  }
  if (role === 'Perawat') {
    // The nurse dashboard remains at `/`; the intake workspace is a separate
    // operational destination linked from this overview.
    return <NurseHome />;
  }
  // Front Desk goes to Front Desk dashboard
  if (role === 'Front Office') {
    return <FrontDeskHome user={user} />;
  }
  // Keep the operational manager dashboard mounted on the home route so the
  // sidebar's Beranda link stays at `/` instead of redirecting back to the
  // Manajer Operasional module. The module remains available separately at
  // `/ops-manager`.
  if (role === 'Manajer Operasional') {
    return <OpsManager />;
  }

  switch (role) {
    case 'Apoteker':
    case 'Apoteker Penanggung Jawab':
    case 'Apoteker Pendamping':
    case 'Admin Farmasi':
    case 'TTK/Asisten Farmasi':
      return <PharmacistHome user={user} />;
    case 'Owner':
    case 'Admin':
      return <OwnerHome user={user} />;
    case 'Kasir':
      return <KasirHome user={user} />;
    case 'Finance':
      return <FinanceHome user={user} />;
    default:
      return <DefaultHome user={user} />;
  }
}
