import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../utils/ApiError';
import { useApiQuery } from '../hooks/useApiQuery';
import { newPasswordErrors, stableNameErrors } from '@shared/utils/accountRules';
import TutorialSettings from '../components/TutorialSettings';
import { getProfile, ProfileData, updateProfile, ProfileUpdateRequest } from '../utils/userApi';

/**
 * Field and banner messages for a failed save. `api` rejects with an ApiError
 * (status 0 for a network failure); validation errors list their fields in
 * `details.fields`, and a wrong current password is a 401 INVALID_CREDENTIALS.
 */
function saveErrorMessages(error: unknown, changingPassword: boolean): Record<string, string> {
  if (!(error instanceof ApiError)) return { general: 'An unexpected error occurred. Please try again.' };
  switch (error.statusCode) {
    case 0:
      return { general: 'Network error. Please check your connection and try again.' };
    case 400: {
      const fields = (error.details as { fields?: Array<{ field: string; message: string }> } | undefined)?.fields ?? [];
      const fieldErrors = Object.fromEntries(fields.map(({ field, message }) => [field, message]));
      return Object.keys(fieldErrors).length > 0 ? fieldErrors : { general: error.message || 'Failed to update profile' };
    }
    case 401:
      return changingPassword
        ? { currentPassword: 'Current password is incorrect' }
        : { general: 'Authentication failed. Please log in again.' };
    case 409:
      return { stableName: 'This stable name is already taken' };
    default:
      return { general: error.message || 'Failed to update profile' };
  }
}

function ProfilePage() {
  const { user } = useAuth();

  // Component state
  // Loaded once per signed-in user (not on every refreshUser()). A 401 ends the session in the API client.
  // Keyed by user, so a switched account never sees the previous account's profile.
  const userId = user?.id;
  const profileQuery = useApiQuery(
    async () => ({ userId, profile: await getProfile() }),
    [userId],
    { enabled: userId !== undefined },
  );
  const profile = profileQuery.data?.userId === userId ? profileQuery.data?.profile ?? null : null;
  const setProfile = (next: ProfileData): void => profileQuery.setData({ userId, profile: next });
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
  // Shape rules and wording shared with the backend; empty means "unchanged" here.
  const validateStableNameFormat = (name: string): string | null =>
    !name || name.trim().length === 0 ? null : stableNameErrors(name)[0] ?? null;

  const validateStableNoteFormat = (note: string): string | null => {
    if (note.length > 2000) return 'Stable note must be 2000 characters or less';
    return null;
  };

  const validatePasswordFormat = (password: string): string | null =>
    !password ? null : newPasswordErrors(password)[0] ?? null;

  // Check if form has validation errors
  const hasValidationErrors = (): boolean => {
    const stableNameError = editedProfile.stableName !== undefined 
      ? validateStableNameFormat(editedProfile.stableName || '') 
      : null;
    const stableNoteError = editedProfile.stableNote !== undefined
      ? validateStableNoteFormat(editedProfile.stableNote || '')
      : null;
    const newPasswordError = passwordData.new ? validatePasswordFormat(passwordData.new) : null;
    
    return !!(stableNameError || stableNoteError || newPasswordError);
  };

  // Handle form submission
  const handleSave = async () => {
    // Prevent submission if validation errors exist
    if (hasValidationErrors()) {
      return;
    }

    // Build update request
    const updates: ProfileUpdateRequest = {};
    
    // Add edited profile fields (only if they differ from current values)
    if (editedProfile.stableName !== undefined && editedProfile.stableName !== profile?.stableName) {
      updates.stableName = editedProfile.stableName ?? undefined;
    }

    // Send the note only when it differs from the loaded value. An empty string
    // is sent deliberately — the backend trims it to null, clearing the note.
    if (editedProfile.stableNote !== undefined && editedProfile.stableNote !== (profile?.stableNote ?? '')) {
      updates.stableNote = editedProfile.stableNote ?? '';
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
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      setSaveSuccess(false);

      // Call API to update profile
      const updatedProfile = await updateProfile(updates);
      
      // Update profile state with new data
      setProfile(updatedProfile);
      
      // Clear edited state and password fields
      setEditedProfile({});
      setPasswordData({ current: '', new: '' });
      
      // Show success message
      setSaveSuccess(true);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (error: unknown) {
      setErrors(saveErrorMessages(error, Boolean(passwordData.current)));
    } finally {
      setLoading(false);
    }
  };

  const dirty = isDirty();

  // Warn user about unsaved changes when closing/refreshing page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirty]);

  // Navigation guard - warn when navigating away with unsaved changes
  useEffect(() => {
    // This is a simple implementation. For more robust navigation blocking,
    // consider using react-router's useBlocker hook (v6.4+) or a custom solution
    const handleNavigation = () => {
      if (dirty) {
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
  }, [dirty]);

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background text-white">
          <div className="container mx-auto px-4 py-8 flex justify-center items-center">
          {profileQuery.error ? (
            <div className="text-center" role="alert">
              <p className="text-error mb-3">Failed to load profile data</p>
              <button
                type="button"
                onClick={profileQuery.refetch}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors min-h-[44px]"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center">Loading profile...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
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
          <div className="bg-surface-elevated p-6 rounded-lg border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="border-t border-white/10 mb-4"></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-secondary">Username</div>
                <div className="text-base">{profile.username}</div>
              </div>
              <div>
                <div className="text-sm text-secondary">Role</div>
                <div className="text-base">{profile.role}</div>
              </div>
              <div>
                <div className="text-sm text-secondary">Account ID</div>
                <div className="text-base">#{profile.id}</div>
              </div>
              <div>
                <div className="text-sm text-secondary">Join Date</div>
                <div className="text-base">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Stable Identity Section (Editable) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Stable Identity</h2>
            <div className="border-t border-white/10 mb-4"></div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="profile-stable-name" className="block text-sm font-medium mb-2">Stable Name</label>
                <input
                  id="profile-stable-name"
                  type="text"
                  className={`w-full px-3 py-2 bg-surface border rounded min-h-[44px] ${
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
                      const { stableName: _stableName, ...restErrors } = errors;
                      setErrors(restErrors);
                    }
                  }}
                  placeholder={profile.username}
                  maxLength={30}
                />
                <div className={`text-xs mt-1 ${errors.stableName ? 'text-error' : 'text-secondary'}`}>
                  {errors.stableName || `${(editedProfile.stableName ?? profile.stableName ?? '').length}/30 characters`}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-secondary">Display Name Preview</div>
                <div className="text-base">
                  {editedProfile.stableName ?? profile.stableName ?? profile.username}
                </div>
              </div>
            </div>
          </div>

          {/* Stable Notes Section (Editable) — private per-stable strategy note.
              Spans both columns: multi-line content needs the width. */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-white/10 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Stable Notes</h2>
            <div className="border-t border-white/10 mb-4"></div>

            <div className="space-y-2">
              <label htmlFor="profile-stable-note" className="block text-sm font-medium">
                Private strategy note
              </label>
              <p className="text-sm text-secondary">
                Only you can see this. Jot down the long-term plan for this stable so you can pick it
                back up days or weeks later. It shows on your dashboard while it has content.
              </p>
              <textarea
                id="profile-stable-note"
                className={`w-full px-3 py-2 bg-surface border rounded min-h-[120px] resize-y ${
                  errors.stableNote ? 'border-red-500' : 'border-gray-600'
                } focus:outline-none focus:border-primary`}
                value={editedProfile.stableNote ?? profile.stableNote ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditedProfile({ ...editedProfile, stableNote: value });

                  const validationError = validateStableNoteFormat(value);
                  if (validationError) {
                    setErrors({ ...errors, stableNote: validationError });
                  } else {
                    const { stableNote: _stableNote, ...restErrors } = errors;
                    setErrors(restErrors);
                  }
                }}
                placeholder="e.g. Rush Bronze with the twins, bank credits, then push Diamond in cycle 3."
                maxLength={2000}
              />
              <div className={`text-xs ${errors.stableNote ? 'text-error' : 'text-secondary'}`}>
                {errors.stableNote || `${(editedProfile.stableNote ?? profile.stableNote ?? '').length}/2000 characters`}
              </div>
            </div>
          </div>

          {/* Security Section (Editable) */}
          <div className="bg-surface-elevated p-6 rounded-lg border border-white/10">
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <div className="border-t border-white/10 mb-4"></div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="profile-current-password" className="block text-sm font-medium mb-2">Current Password</label>
                <input
                  id="profile-current-password"
                  type="password"
                  className={`w-full px-3 py-2 bg-surface border rounded min-h-[44px] ${
                    errors.currentPassword ? 'border-red-500' : 'border-gray-600'
                  } focus:outline-none focus:border-primary`}
                  value={passwordData.current}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPasswordData({ ...passwordData, current: value });
                    
                    // Clear error when user starts typing
                    if (errors.currentPassword) {
                      const { currentPassword: _currentPassword, ...restErrors } = errors;
                      setErrors(restErrors);
                    }
                  }}
                />
                {errors.currentPassword && (
                  <div className="text-xs text-error mt-1">{errors.currentPassword}</div>
                )}
              </div>
              
              <div>
                <label htmlFor="profile-new-password" className="block text-sm font-medium mb-2">New Password</label>
                <input
                  id="profile-new-password"
                  type="password"
                  className={`w-full px-3 py-2 bg-surface border rounded min-h-[44px] ${
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
                      const { newPassword: _newPassword, ...restErrors } = errors;
                      setErrors(restErrors);
                    }
                  }}
                />
                <div className={`text-xs mt-1 ${errors.newPassword ? 'text-error' : 'text-secondary'}`}>
                  {errors.newPassword || 'Min 8 chars, 1 uppercase, 1 lowercase, 1 number'}
                </div>
              </div>
            </div>
          </div>

          {/* Tutorial Section */}
          <TutorialSettings />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 justify-end">
          <button
            className="px-6 py-2 border border-gray-600 rounded hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
            className="px-6 py-2 bg-primary hover:bg-primary-dark rounded disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
