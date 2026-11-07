import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import DoctorHome from '@/components/home/DoctorHome';

export default function DoctorPortal() {
  const { user } = useAuth();
  return <DoctorHome user={user} />;
}