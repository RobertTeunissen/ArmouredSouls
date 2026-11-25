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
import { useApiQuery } from '../../hooks/useApiQuery';
import { FACILITY_CATEGORIES } from './constants';
import type { TabType, Facility } from './types';
import type {
  AllEconomicROIsResult,
  FacilitiesOverviewResponse,
  FacilityRecommendation,
  RecommendationSummary,
  UnifiedFacilityROI,
} from '@shared/types';
import { createLogger } from '../../utils/logger';

const log = createLogger('useFacilities');

export function useFacilities() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const currency = useStableStore(state => state.currency);
  const refreshCurrency = useStableStore(state => state.refreshCurrency);
  const fetchStableData = useStableStore(state => state.fetchStableData);
  const [activeTab, setActiveTab] = useState<TabType>('facilities');
  const facilitiesQuery = useApiQuery(
    (signal) => api.get<FacilitiesOverviewResponse>('/api/facilities', { signal }),
    [],
  );
  const facilities: Facility[] = facilitiesQuery.data?.facilities ?? [];
  const userPrestige = facilitiesQuery.data?.userPrestige ?? 0;
  const loading = facilitiesQuery.loading && facilitiesQuery.data === null;
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState('');
  const error = upgradeError || (facilitiesQuery.error ? 'Failed to load facilities' : '');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(['advanced']) // Advanced Features collapsed by default
  );
  const facilityRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Investment overview: loaded when its tab opens. Each part fails on its own,
  // so the tab stays usable with whatever loaded.
  const userId = user?.id;
  const advisorQuery = useApiQuery(
    async (signal) => {
      const [rois, recs] = await Promise.all([
        api.get<AllEconomicROIsResult>(`/api/analytics/facility/${userId}/roi/all-economic`, { signal })
          .then((data) => data.facilities)
          .catch((err: unknown): UnifiedFacilityROI[] => { log.error('Error fetching ROI data', { err }); return []; }),
        api.get<RecommendationSummary>(`/api/analytics/facility/${userId}/recommendations`, { signal })
          .then((data) => data.recommendations)
          .catch((err: unknown): FacilityRecommendation[] => { log.error('Error fetching recommendations', { err }); return []; }),
      ]);
      return { rois, recs };
    },
    [userId],
    { enabled: activeTab === 'investment-overview' && userId !== undefined },
  );
  const facilityROIs = advisorQuery.data?.rois ?? [];
  const recommendations = advisorQuery.data?.recs ?? [];
  const advisorLoading = activeTab === 'investment-overview' && advisorQuery.loading;

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

  // Ensure the stable store is populated for currency data
  useEffect(() => {
    fetchStableData();
  }, [fetchStableData]);

  const handleUpgrade = async (facilityType: string) => {
    setUpgrading(facilityType);
    setUpgradeError('');

    try {
      await api.post('/api/facilities/upgrade', { facilityType });

      // Refresh facilities, user data, and store currency
      facilitiesQuery.refetch();
      await Promise.all([refreshUser(), refreshCurrency()]);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 403) {
        const details = err.details as { current?: number; message?: string } | undefined;
        const current = details?.current;
        const message = details?.message ?? err.message;
        setUpgradeError(`${message}${current != null ? `. You have ${current.toLocaleString()} prestige.` : ''}`);
      } else {
        setUpgradeError((err instanceof ApiError && err.message) || 'Upgrade failed');
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

  /** The facility's name from the overview, else its type. */
  const getFacilityDisplayName = (type: string): string =>
    facilities.find((f) => f.type === type)?.name ?? type;

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
  };
}
