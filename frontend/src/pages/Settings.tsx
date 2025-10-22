import React, { useState } from 'react';
import { User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import authAPI from '../services/authAPI';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authAPI.getCurrentUser();
  
  const [profile, setProfile] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    company: '',
  });

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
  };

  const handleSave = () => {
    localStorage.setItem('userProfile', JSON.stringify(profile));
    alert('Settings saved');
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-light text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account</p>
        </div>

        {/* Profile Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h2 className="text-2xl font-medium text-gray-900">{profile.name}</h2>
              <p className="text-gray-600">{profile.email}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Company</label>
              <input
                type="text"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                placeholder="Optional"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Re-upload Portfolio
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
