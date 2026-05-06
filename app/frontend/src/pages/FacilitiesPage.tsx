/**
 * FacilitiesPage — Stable Facilities management with upgrades and investment overview.
 *
 * Page-level orchestrator that composes sub-components from ../components/facilities/.
 * Extracted during component splitting (Spec 18).
 * Updated in Spec 30 to consolidate tabs (2 tabs instead of 3).
 */

import Navigation from '../components/Navigation';
import {
  FacilitiesTab,
  InvestmentOverviewTab,
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
    facilityROIs,
    recommendations,
    advisorLoading,
    handleUpgrade,
    toggleCategory,
    getCategoryFacilities,
    getFacilityDisplayName,
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
                onClick={() => setActiveTab('investment-overview')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'investment-overview'
                    ? 'border-blue-500 text-primary'
                    : 'border-transparent text-secondary hover:text-secondary hover:border-gray-300'
                  }
                `}
              >
                Investment Overview
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

            {activeTab === 'investment-overview' && (
              <InvestmentOverviewTab
                loading={advisorLoading}
                facilityROIs={facilityROIs}
                recommendations={recommendations}
                getFacilityDisplayName={getFacilityDisplayName}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FacilitiesPage;
