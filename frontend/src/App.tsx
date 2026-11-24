import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components';
import { AuthProvider } from '@/features/auth/AuthContext';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { PortalLayout } from '@/layouts/PortalLayout';
import { AdminLayout } from '@/layouts/AdminLayout';

/* Portal pages (written by portal build pass) */
import { LandingPage } from '@/pages/portal/LandingPage';
import { PurchasePage } from '@/pages/portal/PurchasePage';
import { TokenLoginPage } from '@/pages/portal/TokenLoginPage';
import { SubscriptionPage } from '@/pages/portal/SubscriptionPage';
import { DeviceReplacementPage } from '@/pages/portal/DeviceReplacementPage';

/* Admin pages (written by admin build pass) */
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { OverviewPage } from '@/pages/admin/OverviewPage';
import { CustomersPage } from '@/pages/admin/CustomersPage';
import { PackagesPage } from '@/pages/admin/PackagesPage';
import { SubscriptionsPage } from '@/pages/admin/SubscriptionsPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { NetworkPage } from '@/pages/admin/NetworkPage';
import { AnalyticsPage } from '@/pages/admin/AnalyticsPage';
import { AuditLogPage } from '@/pages/admin/AuditLogPage';

import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Customer portal */}
            <Route element={<PortalLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/buy" element={<PurchasePage />} />
              <Route path="/connect" element={<TokenLoginPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/device-replacement" element={<DeviceReplacementPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="packages" element={<PackagesPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="network" element={<NetworkPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="audit" element={<AuditLogPage />} />
              </Route>
            </Route>
            <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
