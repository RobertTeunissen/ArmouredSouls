/**
 * Custom hook for Facilities page state management and data fetching.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../utils/apiClient';
import { useStableStore } from '../../stores';
import { FACILITY_CATEGORIES } from './constants';
import type { TabType, Facility, FacilityROI, FacilityRecommendation } from './types';

export function useFacilities() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const currency = useStableStore(state => state.currency);
  const refreshCurrency = useStableStore(state => state.refreshCurrency);
  const fetchStableData = useStableStore(state => state.fetchStableData);
  const [activeTab, setActiveTab] = useState<TabType>('facilities');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [userPrestige, setUserPrestige] = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(['advanced']) // Advanced Features collapsed by default
  );
  const facilityRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Advisor tab state
  const [lastNCycles, setLastNCycles] = useState(10);
  const [facilityROIs, setFacilityROIs] = useState<FacilityROI[]>([]);
  const [recommendations, setRecommendations] = useState<FacilityRecommendation[]>([]);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [currentCycle, setCurrentCycle] = useState<number>(0);

  // Handle hash-based scrolling to specific facility
  useEffect(() => {
    if (loading || !location.hash) return;

    const facilityType = location.hash.slice(1); // Remove the '#'

    // Find which category contains this facility and expand it if collapsed
    const category = FACILITY_CATEGORIES.find(cat => cat.facilityTypes.includes(facilityType));
    if (category && collapsedCategories.has(category.id)) {
      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(category.id);
        return newSet;
      });
    }

    // Scroll to the facility after a short delay to allow DOM update
    setTimeout(() => {
      const element = facilityRefs.current[facilityType];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a highlight effect
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-background');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-background');
        }, 3000);
      }
    }, 100);
  }, [loading, location.hash, collapsedCategories]);

  useEffect(() => {
    fetchFacilities();
    // Ensure the stable store is populated for currency data
    fetchStableData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ((activeTab === 'advisor' || activeTab === 'investments') && user) {
      fetchAdvisorData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user, lastNCycles]);

  const fetchFacilities = async () => {
    try {
      const response = await apiClient.get('/api/facilities');
      setFacilities(response.data.facilities || response.data);
      setUserPrestige(response.data.userPrestige || 0);
    } catch (err) {
      setError('Failed to load facilities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvisorData = async () => {
    if (!user) return;

    try {
      setAdvisorLoading(true);

      // Fetch current cycle
      let fetchedCurrentCycle = 0;
      try {
        const cycleResponse = await apiClient.get('/api/analytics/cycle/current');
        if (cycleResponse.status === 200) {
          const cycleData = cycleResponse.data;
          fetchedCurrentCycle = cycleData.cycleNumber;
          setCurrentCycle(fetchedCurrentCycle);
        }
      } catch (err) {
        console.error('Error fetching current cycle:', err);
      }

      // Fetch ROI data for all Economy & Discounts facilities
      const facilityTypes = ['merchandising_hub', 'streaming_studio', 'repair_bay', 'training_facility', 'weapons_workshop'];
      const roiPromises = facilityTypes.map(async (type) => {
        try {
          const response = await apiClient.get(`/api/analytics/facility/${user.id}/roi?facilityType=${type}`);
          if (response.status === 200) {
            return response.data;
          }
          return null;
        } catch (err) {
          console.error(`Error fetching ROI for ${type}:`, err);
          return null;
        }
      });

      const roiData = (await Promise.all(roiPromises)).filter(Boolean);
      setFacilityROIs(roiData);

      // Fetch recommendations
      try {
        const recResponse = await apiClient.get(
          `/api/analytics/facility/${user.id}/recommendations?lastNCycles=${lastNCycles}`
        );
        if (recResponse.status === 200) {
          const recData = recResponse.data;
          setRecommendations(recData.recommendations || []);
        } else {
          setRecommendations([]);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setRecommendations([]);
      }
    } catch (err) {
      console.error('Error in fetchAdvisorData:', err);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleUpgrade = async (facilityType: string) => {
    setUpgrading(facilityType);
    setError('');

    try {
      await apiClient.post('/api/facilities/upgrade', {
        facilityType,
      });

      // Refresh facilities, user data, and store currency
      await Promise.all([fetchFacilities(), refreshUser(), refreshCurrency()]);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (err.response?.status === 403) {
        const { current, message } = err.response.data;
        setError(`${message}. You have ${current?.toLocaleString()} prestige.`);
      } else {
        setError(err.response?.data?.error || 'Upgrade failed');
      }
    } finally {
      setUpgrading(null);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const getCategoryFacilities = (categoryTypes: string[]) => {
    return facilities.filter(f => categoryTypes.includes(f.type));
  };

  const getFacilityDisplayName = (type: string): string => {
    const names: Record<string, string> = {
      merchandising_hub: 'Merchandising Hub',
      streaming_studio: 'Streaming Studio',
      repair_bay: 'Repair Bay',
      training_facility: 'Training Facility',
      weapons_workshop: 'Weapons Workshop',
    };
    return names[type] || type;
  };

  const getROIColor = (roiPercentage: number): string => {
    if (roiPercentage >= 50) return 'text-success';
    if (roiPercentage >= 20) return 'text-primary';
    if (roiPercentage >= 0) return 'text-warning';
    return 'text-error';
  };

  return {
    user,
    currency,
    activeTab, setActiveTab,
    facilities,
    userPrestige,
    loading,
    upgrading,
    error,
    collapsedCategories,
    facilityRefs,
    lastNCycles, setLastNCycles,
    facilityROIs,
    recommendations,
    advisorLoading,
    currentCycle,
    handleUpgrade,
    toggleCategory,
    getCategoryFacilities,
    getFacilityDisplayName,
    getROIColor,
    fetchAdvisorData,
  };
}
