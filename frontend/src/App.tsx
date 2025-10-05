import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AdminDashboard from './pages/AdminDashboard';
import AdminDocsPage from './pages/AdminDocsPage';
import AreasPage from './pages/AreasPage';
import Dashboard from './pages/Dashboard';
import CustomAlertsPage from './pages/CustomAlertsPage';
import AlertHistoryPage from './pages/AlertHistoryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Toaster from './components/Toaster';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/docs"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDocsPage />
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="areas" element={<AreasPage />} />
              <Route path="custom-alerts" element={<CustomAlertsPage />} />
              <Route path="history" element={<AlertHistoryPage />} />
            </Route>
          </Routes>
          <Toaster />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
