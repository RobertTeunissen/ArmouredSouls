import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { getProfile, ProfileData, updateProfile, ProfileUpdateRequest } from '../utils/userApi';

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Component state
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editedProfile, setEditedProfile] = useState<Partial<ProfileData>>({});
  const [passwordData, setPasswordData] = useState({ current: '', new: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Track if form has unsaved changes
  const isDirty = (): boolean => {
    return Object.keys(editedProfile).length > 0 || passwordData.current.length > 0 || passwordData.new.length > 0;
  };

  // Validation functions
  const validateStableNameFormat = (name: string): string | null => {
    if (!name || name.trim().length === 0) return null; // Empty is valid (optional field)
    if (name.length < 3) return 'Stable name must be at least 3 characters';
    if (name.length > 30) return 'Stable name must be 30 characters or less';
    if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
      return 'Stable name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return null;
  };

  const validatePasswordFormat = (password: string): string | null => {
    if (!password || password.length === 0) return null; // Empty is valid (optional field)
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    return null;
  };

  // Check if form has validation errors
  const hasValidationErrors = (): boolean => {
    const stableNameError = editedProfile.stableName !== undefined 
      ? validateStableNameFormat(editedProfile.stableName || '') 
      : null;
    const newPasswordError = passwordData.new ? validatePasswordFormat(passwordData.new) : null;
    
    return !!(stableNameError || newPasswordError);
  };

  // Handle form submission
  const handleSave = async () => {
    // Prevent submission if validation errors exist
    if (hasValidationErrors()) {
      console.log('Validation errors exist, not submitting');
      return;
    }

    // Build update request
    const updates: ProfileUpdateRequest = {};
    
    // Add edited profile fields (only if they differ from current values)
    if (editedProfile.stableName !== undefined && editedProfile.stableName !== profile?.stableName) {
      updates.stableName = editedProfile.stableName;
    }
    if (editedProfile.profileVisibility !== undefined && editedProfile.profileVisibility !== profile?.profileVisibility) {
      updates.profileVisibility = editedProfile.profileVisibility;
    }
    if (editedProfile.notificationsBattle !== undefined && editedProfile.notificationsBattle !== profile?.notificationsBattle) {
      updates.notificationsBattle = editedProfile.notificationsBattle;
    }
    if (editedProfile.notificationsLeague !== undefined && editedProfile.notificationsLeague !== profile?.notificationsLeague) {
      updates.notificationsLeague = editedProfile.notificationsLeague;
    }
    if (editedProfile.themePreference !== undefined && editedProfile.themePreference !== profile?.themePreference) {
      updates.themePreference = editedProfile.themePreference;
    }
    
    // Add password change if provided
    if (passwordData.new) {
      if (!passwordData.current) {
        setErrors({ ...errors, currentPassword: 'Current password is required to change password' });
        return;
      }
      updates.currentPassword = passwordData.current;
      updates.newPassword = passwordData.new;
    }

    // Check if there are any updates to submit
    if (Object.keys(updates).length === 0) {
      console.log('No changes detected, not submitting');
      return;
    }

    console.log('Submitting updates:', updates);

    try {
      setLoading(true);
      setErrors({});
      setSaveSuccess(false);

      // Call API to update profile
      const updatedProfile = await updateProfile(updates);
      
      console.log('Profile updated successfully:', updatedProfile);
      
      // Update profile state with new data
      setProfile(updatedProfile);
      
      // Clear edited state and password fields
      setEditedProfile({});
      setPasswordData({ current: '', new: '' });
      
      // Show success message
      setSaveSuccess(true);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      console.error('Error response:', error.response);
      
      // Handle API error responses
      if (error.response) {
        const { status, data } = error.response;
        
        console.log('API error status:', status);
        console.log('API error data:', data);
        
        if (status === 400 && data.details) {
          // Validation errors - display field-specific errors
          setErrors(data.details);
        } else if (status === 401) {
          // Authentication error
          if (passwordData.current) {
            setErrors({ currentPassword: 'Current password is incorrect' });
          } else {
            setErrors({ general: 'Authentication failed. Please log in again.' });
          }
        } else if (status === 409) {
          // Conflict error (duplicate stable name)
          setErrors({ stableName: 'This stable name is already taken' });
        } else {
          // Other API errors
          setErrors({ general: data.error || data.details || 'Failed to update profile' });
        }
      } else if (error.request) {
        // Network error
        setErrors({ general: 'Network error. Please check your connection and try again.' });
      } else {
        // Other errors
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          logout();
          navigate('/login');
          return;
        }

        setLoading(true);
        const profileData = await getProfile();
        setProfile(profileData);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        setErrors({ general: 'Failed to load profile data' });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfileData();
    }
  }, [user, logout, navigate]);

  // Warn user about unsaved changes when closing/refreshing page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editedProfile, passwordData]);

  // Navigation guard - warn when navigating away with unsaved changes
  useEffect(() => {
    // This is a simple implementation. For more robust navigation blocking,
    // consider using react-router's useBlocker hook (v6.4+) or a custom solution
    const handleNavigation = () => {
      if (isDirty()) {
        const confirmLeave = window.confirm(
          'You have unsaved changes. Are you sure you want to leave this page?'
        );
        if (!confirmLeave) {
          // Push current state back to prevent navigation
          window.history.pushState(null, '', window.location.pathname);
        }
      }
    };

    // Listen for browser back/forward button
    window.addEventListener('popstate', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
    };
  }, [editedProfile, passwordData]);

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8 flex justify-center items-center">
          {loading ? (
            <div className="text-center">Loading profile...</div>
          ) : (
            <div className="text-center">Loading profile...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="bg-green-900/30 border border-green-500 text-green-200 px-4 py-3 rounded mb-6 flex justify-between items-center">
            <span>Profile updated successfully!</span>
            <button onClick={() => setSaveSuccess(false)} className="text-green-200 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* General Error */}
        {errors.general && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded mb-6 flex justify-between items-center">
            <span>{errors.general}</span>
            <button onClick={() => setErrors({ ...errors, general: '' })} className="text-red-200 hover:text-white">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Information Section (Read-only) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="border-t border-gray-700 mb-4"></div>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400">Username</div>
                <div className="text-base">{profile.username}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Role</div>
                <div className="text-base">{profile.role}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Account ID</div>
                <div className="text-base">#{profile.id}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Join Date</div>
                <div className="text-base">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Stable Identity Section (Editable) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Stable Identity</h2>
            <div className="border-t border-gray-700 mb-4"></div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Stable Name</label>
                <input
                  type="text"
                  className={`w-full px-3 py-2 bg-surface border rounded ${
                    errors.stableName ? 'border-red-500' : 'border-gray-600'
                  } focus:outline-none focus:border-primary`}
                  value={editedProfile.stableName ?? profile.stableName ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditedProfile({ ...editedProfile, stableName: value });
                    
                    // Real-time validation
                    const validationError = validateStableNameFormat(value);
                    if (validationError) {
                      setErrors({ ...errors, stableName: validationError });
                    } else {
                      const { stableName, ...restErrors } = errors;
                      setErrors(restErrors);
                    }
                  }}
                  placeholder={profile.username}
                  maxLength={30}
                />
                <div className={`text-xs mt-1 ${errors.stableName ? 'text-red-400' : 'text-gray-400'}`}>
                  {errors.stableName || `${(editedProfile.stableName ?? profile.stableName ?? '').length}/30 characters`}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-400">Display Name Preview</div>
                <div className="text-base">
                  {editedProfile.stableName ?? profile.stableName ?? profile.username}
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Section (Read-only) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Statistics</h2>
            <div className="border-t border-gray-700 mb-4"></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400">Currency</div>
                <div className="text-base">₡{profile.currency.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Prestige</div>
                <div className="text-base">{profile.prestige.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Total Battles</div>
                <div className="text-base">{profile.totalBattles}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Total Wins</div>
                <div className="text-base">{profile.totalWins}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Highest ELO</div>
                <div className="text-base">{profile.highestELO}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Championship Titles</div>
                <div className="text-base">{profile.championshipTitles}</div>
              </div>
            </div>
          </div>

          {/* Privacy Settings Section (Editable) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Privacy Settings</h2>
            <div className="border-t border-gray-700 mb-4"></div>
            
            <div className="space-y-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-primary bg-surface border-gray-600 rounded focus:ring-primary"
                  checked={(editedProfile.profileVisibility ?? profile.profileVisibility) === 'public'}
                  onChange={(e) => setEditedProfile({ 
                    ...editedProfile, 
                    profileVisibility: e.target.checked ? 'public' : 'private' 
                  })}
                />
                <span className="ml-3">Show my statistics on public leaderboards</span>
              </label>
              <div className="text-xs text-gray-400">
                When disabled, your statistics will be hidden from public leaderboards
              </div>
            </div>
          </div>

          {/* Display Preferences Section (Editable) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Display Preferences</h2>
            <div className="border-t border-gray-700 mb-4"></div>
            
            <div className="space-y-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-primary bg-surface border-gray-600 rounded focus:ring-primary"
                  checked={editedProfile.notificationsBattle ?? profile.notificationsBattle}
                  onChange={(e) => setEditedProfile({ 
                    ...editedProfile, 
                    notificationsBattle: e.target.checked 
                  })}
                />
                <span className="ml-3">Battle Notifications</span>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-primary bg-surface border-gray-600 rounded focus:ring-primary"
                  checked={editedProfile.notificationsLeague ?? profile.notificationsLeague}
                  onChange={(e) => setEditedProfile({ 
                    ...editedProfile, 
                    notificationsLeague: e.target.checked 
                  })}
                />
                <span className="ml-3">League Notifications</span>
              </label>
              
              <div>
                <label className="block text-sm font-medium mb-2">Theme Preference</label>
                <select
                  className="w-full px-3 py-2 bg-surface border border-gray-600 rounded focus:outline-none focus:border-primary"
                  value={editedProfile.themePreference ?? profile.themePreference}
                  onChange={(e) => setEditedProfile({ 
                    ...editedProfile, 
                    themePreference: e.target.value as 'dark' | 'light' | 'auto' 
                  })}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security Section (Editable) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <div className="border-t border-gray-700 mb-4"></div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <input
                  type="password"
                  className={`w-full px-3 py-2 bg-surface border rounded ${
                    errors.currentPassword ? 'border-red-500' : 'border-gray-600'
                  } focus:outline-none focus:border-primary`}
                  value={passwordData.current}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPasswordData({ ...passwordData, current: value });
                    
                    // Clear error when user starts typing
                    if (errors.currentPassword) {
                      const { currentPassword, ...restErrors } = errors;
                      setErrors(restErrors);
                    }
                  }}
                />
                {errors.currentPassword && (
                  <div className="text-xs text-red-400 mt-1">{errors.currentPassword}</div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  className={`w-full px-3 py-2 bg-surface border rounded ${
                    errors.newPassword ? 'border-red-500' : 'border-gray-600'
                  } focus:outline-none focus:border-primary`}
                  value={passwordData.new}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPasswordData({ ...passwordData, new: value });
                    
                    // Real-time validation
                    const validationError = validatePasswordFormat(value);
                    if (validationError) {
                      setErrors({ ...errors, newPassword: validationError });
                    } else {
                      const { newPassword, ...restErrors } = errors;
                      setErrors(restErrors);
                    }
                  }}
                />
                <div className={`text-xs mt-1 ${errors.newPassword ? 'text-red-400' : 'text-gray-400'}`}>
                  {errors.newPassword || 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 justify-end">
          <button
            className="px-6 py-2 border border-gray-600 rounded hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              setEditedProfile({});
              setPasswordData({ current: '', new: '' });
              setErrors({});
              setSaveSuccess(false);
            }}
            disabled={loading}
          >
            Cancel
          </button>
          
          <button
            className="px-6 py-2 bg-primary hover:bg-primary-dark rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={
              loading || 
              (Object.keys(editedProfile).length === 0 && !passwordData.current && !passwordData.new) ||
              hasValidationErrors()
            }
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
