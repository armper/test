import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import AreasPage from './pages/AreasPage';
import Dashboard from './pages/Dashboard';
import CustomAlertsPage from './pages/CustomAlertsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <AuthProvider>
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
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="areas" element={<AreasPage />} />
          <Route path="custom-alerts" element={<CustomAlertsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
