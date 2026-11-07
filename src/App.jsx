import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import Patients from '@/pages/Patients';
import Queue from '@/pages/Queue';
import DoctorExam from '@/pages/DoctorExam';
import PharmacyPOS from '@/pages/PharmacyPOS';
import Inventory from '@/pages/Inventory';
import Purchasing from '@/pages/Purchasing';
import Finance from '@/pages/Finance';
import Management from '@/pages/Management';
import HRManagement from '@/pages/HRManagement';
import ScheduleManagement from '@/pages/ScheduleManagement';
import FacilityManagement from '@/pages/FacilityManagement';
import TVDisplay from '@/pages/TVDisplay';
import Settings from '@/pages/Settings';
import SearchHelpSettings from '@/pages/SearchHelpSettings';
import Kasir from '@/pages/Kasir';
import DoctorScheduleMgmt from '@/pages/DoctorScheduleMgmt';
import ScheduleApprovals from '@/pages/ScheduleApprovals';
import InternalComms from '@/pages/InternalComms';
import PortalLayout from '@/components/PortalLayout';
import PatientPortal from '@/pages/PatientPortal';
import PatientRecords from '@/pages/PatientRecords';
import PatientBooking from '@/pages/PatientBooking';
import PatientBilling from '@/pages/PatientBilling';
import RoleGuard from '@/components/RoleGuard';
import RoleManagement from '@/pages/RoleManagement';
import AuditLogPage from '@/pages/AuditLogPage';
import MasterObat from '@/pages/MasterObat';
import DoctorPortalLayout from '@/components/DoctorPortalLayout';
import DoctorPortal from '@/pages/doctor/DoctorPortal';
import AssistantDashboard from '@/pages/doctor/AssistantDashboard';
import ClinicalWorkspace from '@/pages/doctor/ClinicalWorkspace';
import DoctorPatients from '@/pages/doctor/DoctorPatients';
import DoctorHistory from '@/pages/doctor/DoctorHistory';
import DoctorScheduleView from '@/pages/doctor/DoctorScheduleView';
import DoctorRequests from '@/pages/doctor/DoctorRequests';
import DoctorJasa from '@/pages/doctor/DoctorJasa';
import DoctorSelfProfile from '@/pages/doctor/DoctorSelfProfile';
import DoctorExamTemplates from '@/pages/doctor/DoctorExamTemplates';
import DoctorComms from '@/pages/doctor/DoctorComms';
import { DoctorContextProvider } from '@/lib/doctorContext';
import DoctorManagement from '@/pages/DoctorManagement';
import Odontogram from '@/pages/Odontogram';
import GrowthChart from '@/pages/GrowthChart';
import FrontDesk from '@/pages/FrontDesk';
import FrontDeskDocuments from '@/pages/FrontDeskDocuments';
import OpsManager from '@/pages/OpsManager';
import KontrolUsaha from '@/pages/KontrolUsaha';
import Documents from '@/pages/Documents';
import RequiredDocuments from '@/pages/RequiredDocuments';
import UatCenter from '@/pages/UatCenter';
import LocalDataStatus from '@/components/LocalDataStatus';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/tv-display" element={<TVDisplay />} />
        <Route element={<PortalLayout />}>
          <Route path="/portal" element={<PatientPortal />} />
          <Route path="/portal/records" element={<PatientRecords />} />
          <Route path="/portal/booking" element={<PatientBooking />} />
          <Route path="/portal/billing" element={<PatientBilling />} />
        </Route>
        <Route element={<DoctorPortalLayout />}>
          <Route path="/doctor" element={<RoleGuard path="/doctor"><DoctorPortal /></RoleGuard>} />
          <Route path="/doctor/assistant" element={<RoleGuard path="/doctor/assistant"><AssistantDashboard /></RoleGuard>} />
          <Route path="/doctor/exam" element={<RoleGuard path="/doctor/exam"><ClinicalWorkspace /></RoleGuard>} />
          <Route path="/doctor/patients" element={<RoleGuard path="/doctor/patients"><DoctorPatients /></RoleGuard>} />
          <Route path="/doctor/history" element={<RoleGuard path="/doctor/history"><DoctorHistory /></RoleGuard>} />
          <Route path="/doctor/schedule" element={<RoleGuard path="/doctor/schedule"><DoctorScheduleView /></RoleGuard>} />
          <Route path="/doctor/requests" element={<RoleGuard path="/doctor/requests"><DoctorRequests /></RoleGuard>} />
          <Route path="/doctor/jasa" element={<RoleGuard path="/doctor/jasa"><DoctorJasa /></RoleGuard>} />
          <Route path="/doctor/profile" element={<RoleGuard path="/doctor/profile"><DoctorSelfProfile /></RoleGuard>} />
          <Route path="/doctor/templates" element={<RoleGuard path="/doctor/templates"><DoctorExamTemplates /></RoleGuard>} />
          <Route path="/doctor/comms" element={<RoleGuard path="/doctor/comms"><DoctorComms /></RoleGuard>} />
          <Route path="/odontogram" element={<RoleGuard path="/odontogram"><Odontogram /></RoleGuard>} />
          <Route path="/growth-chart" element={<RoleGuard path="/growth-chart"><GrowthChart /></RoleGuard>} />
        </Route>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/patients" element={<RoleGuard path="/patients"><Patients /></RoleGuard>} />
          <Route path="/queue" element={<RoleGuard path="/queue"><Queue /></RoleGuard>} />
          <Route path="/nurse/intake" element={<RoleGuard path="/nurse/intake"><DoctorContextProvider><AssistantDashboard /></DoctorContextProvider></RoleGuard>} />
          <Route path="/doctor-exam" element={<RoleGuard path="/doctor-exam"><Navigate to="/doctor/exam" replace /></RoleGuard>} />
          <Route path="/pharmacy" element={<RoleGuard path="/pharmacy"><PharmacyPOS /></RoleGuard>} />
          <Route path="/inventory" element={<RoleGuard path="/inventory"><Inventory /></RoleGuard>} />
          <Route path="/purchasing" element={<RoleGuard path="/purchasing"><Purchasing /></RoleGuard>} />
          <Route path="/finance" element={<RoleGuard path="/finance"><Finance /></RoleGuard>} />
          <Route path="/management" element={<RoleGuard path="/management"><Management /></RoleGuard>} />
          <Route path="/hr" element={<RoleGuard path="/hr"><HRManagement /></RoleGuard>} />
          <Route path="/schedule" element={<RoleGuard path="/schedule"><ScheduleManagement /></RoleGuard>} />
          <Route path="/facility" element={<RoleGuard path="/facility"><FacilityManagement /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard path="/settings"><Settings /></RoleGuard>} />
          <Route path="/search-help-settings" element={<RoleGuard path="/search-help-settings"><SearchHelpSettings /></RoleGuard>} />
          <Route path="/kasir" element={<RoleGuard path="/kasir"><Kasir /></RoleGuard>} />
          <Route path="/doctor-schedule" element={<RoleGuard path="/doctor-schedule"><DoctorScheduleMgmt /></RoleGuard>} />
          <Route path="/schedule-approvals" element={<RoleGuard path="/schedule-approvals"><ScheduleApprovals /></RoleGuard>} />
          <Route path="/comms" element={<RoleGuard path="/comms"><InternalComms /></RoleGuard>} />
          <Route path="/master-obat" element={<RoleGuard path="/master-obat"><MasterObat /></RoleGuard>} />
          <Route path="/roles" element={<RoleGuard path="/roles"><RoleManagement /></RoleGuard>} />
          <Route path="/audit-log" element={<RoleGuard path="/audit-log"><AuditLogPage /></RoleGuard>} />
          <Route path="/doctors" element={<RoleGuard path="/doctors"><DoctorManagement /></RoleGuard>} />
          <Route path="/front-desk" element={<RoleGuard path="/front-desk"><FrontDesk /></RoleGuard>} />
          <Route path="/front-desk/documents" element={<RoleGuard path="/front-desk/documents"><FrontDeskDocuments /></RoleGuard>} />
          <Route path="/ops-manager" element={<RoleGuard path="/ops-manager"><OpsManager /></RoleGuard>} />
          <Route path="/kontrol-usaha" element={<RoleGuard path="/kontrol-usaha"><KontrolUsaha /></RoleGuard>} />
          <Route path="/documents" element={<RoleGuard path="/documents"><Documents /></RoleGuard>} />
          <Route path="/required-documents" element={<RoleGuard path="/required-documents"><RequiredDocuments /></RoleGuard>} />
          <Route path="/uat-center" element={<RoleGuard path="/uat-center"><UatCenter /></RoleGuard>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <LocalDataStatus />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
