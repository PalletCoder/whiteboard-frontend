import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AuthPage from './pages/AuthPage';
import WhiteboardPage from './pages/WhiteboardPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route 
            path="/whiteboard" 
            element={
              <PrivateRoute>
                <WhiteboardPage />
              </PrivateRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/whiteboard" replace />} />
          <Route path="*" element={<Navigate to="/whiteboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
