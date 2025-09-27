import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminDashboard from './pages/AdminDashboard';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
