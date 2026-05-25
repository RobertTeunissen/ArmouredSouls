/**
 * Custom hook for Facilities page state management and data fetching.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 * Updated in Spec 30 to use unified ROI endpoint and consolidated tabs.
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStableStore } from '../../stores';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import { FACILITY_CATEGORIES } from './constants';
import type { TabType, Facility, UnifiedFacilityROI, FacilityRecommendation } from './types';
import { createLogger } from '../../utils/logger';

const log = createLogger('useFacilities');

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

  // Investment overview state
  const [facilityROIs, setFacilityROIs] = useState<UnifiedFacilityROI[]>([]);
  const [recommendations, setRecommendations] = useState<FacilityRecommendation[]>([]);
  const [advisorLoading, setAdvisorLoading] = useState(false);

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
    if (activeTab === 'investment-overview' && user) {
      fetchAdvisorData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]);

  const fetchFacilities = async () => {
    try {
      const data = await api.get<{ facilities?: Facility[]; userPrestige?: number } | Facility[]>('/api/facilities');
      // Endpoint may return either `{ facilities, userPrestige }` or the raw array.
      if (Array.isArray(data)) {
        setFacilities(data);
        setUserPrestige(0);
      } else {
        setFacilities(data.facilities ?? []);
        setUserPrestige(data.userPrestige || 0);
      }
    } catch (err) {
      setError('Failed to load facilities');
      log.error('Failed to load facilities', { err });
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvisorData = async () => {
    if (!user) return;

    try {
      setAdvisorLoading(true);

      // Fetch all economic facility ROIs in a single call
      try {
        const roiData = await api.get<{ facilities?: UnifiedFacilityROI[] }>(`/api/analytics/facility/${user.id}/roi/all-economic`);
        setFacilityROIs(roiData.facilities || []);
      } catch (err) {
        log.error('Error fetching ROI data', { err });
        setFacilityROIs([]);
      }

      // Fetch recommendations
      try {
        const recData = await api.get<{ recommendations?: FacilityRecommendation[] }>(
          `/api/analytics/facility/${user.id}/recommendations`,
        );
        setRecommendations(recData.recommendations || []);
      } catch (err) {
        log.error('Error fetching recommendations', { err });
        setRecommendations([]);
      }
    } catch (err) {
      log.error('Error in fetchAdvisorData', { err });
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleUpgrade = async (facilityType: string) => {
    setUpgrading(facilityType);
    setError('');

    try {
      await api.post('/api/facilities/upgrade', { facilityType });

      // Refresh facilities, user data, and store currency
      await Promise.all([fetchFacilities(), refreshUser(), refreshCurrency()]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 403) {
        const details = err.details as { current?: number; message?: string } | undefined;
        const current = details?.current;
        const message = details?.message ?? err.message;
        setError(`${message}${current != null ? `. You have ${current.toLocaleString()} prestige.` : ''}`);
      } else {
        setError((err instanceof ApiError && err.message) || 'Upgrade failed');
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
    facilityROIs,
    recommendations,
    advisorLoading,
    handleUpgrade,
    toggleCategory,
    getCategoryFacilities,
    getFacilityDisplayName,
    fetchAdvisorData,
  };
}
