import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Generation from './pages/Generation';
import Gallery from './pages/Gallery';
import StyleProfile from './pages/StyleProfile';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Coverage from './pages/Coverage';
import Feedback from './pages/Feedback';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Onboarding - No Layout */}
        <Route path="/onboarding" element={<Onboarding />} />
        
        {/* Main App - With Layout */}
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/generate" element={<Generation />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/style-profile" element={<StyleProfile />} />
              <Route path="/settings" element={<Settings />} />
              
              {/* Advanced/Analytics - Hidden in nav, accessible from Settings */}
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/coverage" element={<Coverage />} />
              <Route path="/feedback" element={<Feedback />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
