/**
 * FacilitiesPage — Stable Facilities management with upgrades, investments, and advisor tabs.
 *
 * Page-level orchestrator that composes sub-components from ../components/facilities/.
 * Extracted during component splitting (Spec 18).
 */

import Navigation from '../components/Navigation';
import {
  FacilitiesTab,
  InvestmentsTab,
  AdvisorTab,
  useFacilities,
} from '../components/facilities';

function FacilitiesPage() {
  const {
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
  } = useFacilities();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <h2 className="text-3xl font-bold mb-6">Stable Facilities</h2>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-white/10">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('facilities')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'facilities'
                    ? 'border-blue-500 text-primary'
                    : 'border-transparent text-secondary hover:text-secondary hover:border-gray-300'
                  }
                `}
              >
                Facilities & Upgrades
              </button>
              <button
                onClick={() => setActiveTab('investments')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'investments'
                    ? 'border-blue-500 text-primary'
                    : 'border-transparent text-secondary hover:text-secondary hover:border-gray-300'
                  }
                `}
              >
                Investments & ROI
              </button>
              <button
                onClick={() => setActiveTab('advisor')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'advisor'
                    ? 'border-blue-500 text-primary'
                    : 'border-transparent text-secondary hover:text-secondary hover:border-gray-300'
                  }
                `}
              >
                Investment Advisor
              </button>
            </nav>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl">Loading facilities...</div>
          </div>
        ) : (
          <>
            {activeTab === 'facilities' && (
              <FacilitiesTab
                facilities={facilities}
                currency={currency}
                userPrestige={userPrestige}
                upgrading={upgrading}
                collapsedCategories={collapsedCategories}
                facilityRefs={facilityRefs}
                onUpgrade={handleUpgrade}
                onToggleCategory={toggleCategory}
                getCategoryFacilities={getCategoryFacilities}
              />
            )}

            {activeTab === 'investments' && (
              <InvestmentsTab
                advisorLoading={advisorLoading}
                facilityROIs={facilityROIs}
                currentCycle={currentCycle}
                getFacilityDisplayName={getFacilityDisplayName}
                getROIColor={getROIColor}
              />
            )}

            {activeTab === 'advisor' && (
              <AdvisorTab
                advisorLoading={advisorLoading}
                lastNCycles={lastNCycles}
                setLastNCycles={setLastNCycles}
                recommendations={recommendations}
                facilityROIs={facilityROIs}
                getFacilityDisplayName={getFacilityDisplayName}
                getROIColor={getROIColor}
                onRefresh={fetchAdvisorData}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FacilitiesPage;
