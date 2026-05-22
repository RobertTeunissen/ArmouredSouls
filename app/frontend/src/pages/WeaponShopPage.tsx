/**
 * WeaponShopPage — Weapon purchasing with filtering, comparison, and storage management.
 *
 * Page-level orchestrator that composes sub-components from ../components/weapon-shop/.
 * Extracted during component splitting (Spec 18).
 *
 * Spec #33 added a "My Inventory" tab for weapon resale.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import ViewModeToggle from '../components/ViewModeToggle';
import WeaponTable from '../components/WeaponTable';
import FilterPanel from '../components/FilterPanel';
import ActiveFiltersDisplay from '../components/ActiveFiltersDisplay';
import ComparisonBar from '../components/ComparisonBar';
import ComparisonModal from '../components/ComparisonModal';
import WeaponDetailModal from '../components/WeaponDetailModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { calculateWeaponWorkshopDiscount } from '../../../shared/utils/discounts';
import {
  StorageCapacityBar,
  WeaponCardGrid,
  InventoryTab,
  useWeaponShop,
  type Weapon,
} from '../components/weapon-shop';

function WeaponShopPage() {
  const {
    user,
    weapons,
    inventory,
    refreshInventory,
    processedWeapons,
    groupedWeapons,
    ownedWeapons,
    equippedWeaponsCount,
    weaponWorkshopLevel,
    storageStatus,
    loading,
    error,
    purchasing,
    selectedWeapon, setSelectedWeapon,
    viewMode,
    filters,
    selectedForComparison,
    showComparisonModal, setShowComparisonModal,
    confirmationModal, setConfirmationModal,
    handleViewModeChange,
    handleFiltersChange,
    handleRemoveFilter,
    handlePurchase,
    calculateDiscountedPrice,
    toggleComparison,
    handleCompare,
    handleClearComparison,
    handleRemoveFromComparison,
    getTypeColor,
    getAttributeBonuses,
    getLoadoutTypeLabel,
    getLoadoutTypeColor,
  } = useWeaponShop();

  // Tab state — bound to ?tab= URL param so refresh keeps the tab (Spec #33 R5.1)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'inventory' ? 'inventory' : 'catalog';
  const switchTab = (tab: 'catalog' | 'inventory') => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'catalog') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  const [saleSuccessMessage, setSaleSuccessMessage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Weapon Shop</h1>
          <p className="text-secondary">Purchase weapons to equip your robots. Weapons provide attribute bonuses and combat capabilities.</p>
        </div>

        {/* Tab bar (Spec #33 R5.1) */}
        <div className="flex gap-2 border-b border-secondary/30 mb-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'catalog'}
            onClick={() => switchTab('catalog')}
            className={
              'px-4 py-2 -mb-px border-b-2 transition-colors ' +
              (activeTab === 'catalog'
                ? 'border-blue-500 text-blue-300 font-semibold'
                : 'border-transparent text-secondary hover:text-white')
            }
            data-testid="tab-catalog"
          >
            Catalog
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inventory'}
            onClick={() => switchTab('inventory')}
            className={
              'px-4 py-2 -mb-px border-b-2 transition-colors ' +
              (activeTab === 'inventory'
                ? 'border-blue-500 text-blue-300 font-semibold'
                : 'border-transparent text-secondary hover:text-white')
            }
            data-testid="tab-inventory"
          >
            My Inventory ({inventory.length})
          </button>
        </div>

        {/* Sale success toast (Spec #33 R5.7) */}
        {saleSuccessMessage && (
          <div
            className="bg-emerald-900/40 border border-emerald-500 text-emerald-200 px-4 py-3 rounded mb-4 flex justify-between items-center"
            data-testid="sale-success-message"
          >
            <span>{saleSuccessMessage}</span>
            <button
              type="button"
              onClick={() => setSaleSuccessMessage(null)}
              className="text-emerald-300 hover:text-white px-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Storage Capacity (Catalog tab only) */}
        {activeTab === 'catalog' && storageStatus && (
          <StorageCapacityBar
            storageStatus={storageStatus}
            equippedWeaponsCount={equippedWeaponsCount}
          />
        )}

        {loading && (
          <div className="text-center py-12 text-secondary">
            Loading weapons...
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded mb-6">
            <p className="mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && activeTab === 'inventory' && (
          <InventoryTab
            inventory={inventory}
            workshopLevel={weaponWorkshopLevel}
            onSellComplete={async (result) => {
              setSaleSuccessMessage(`Sold ${result.weaponName} for ₡${result.salePrice.toLocaleString()}`);
              await refreshInventory();
              // Auto-dismiss the toast after 5 seconds
              setTimeout(() => setSaleSuccessMessage(null), 5000);
            }}
          />
        )}

        {!loading && !error && activeTab === 'catalog' && (
          <>
            {/* Filter Panel */}
            <FilterPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              userCredits={user?.currency || 0}
              weaponCount={weapons.length}
              filteredCount={processedWeapons.length}
            />

            {/* Active Filters Display */}
            <ActiveFiltersDisplay
              filters={filters}
              onRemoveFilter={handleRemoveFilter}
            />

            {/* View Mode Toggle */}
            <div className="flex justify-end mb-6">
              <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="bg-surface rounded-lg overflow-hidden">
                <WeaponTable
                  weapons={processedWeapons}
                  onPurchase={handlePurchase}
                  calculateDiscountedPrice={calculateDiscountedPrice}
                  userCredits={user?.currency || 0}
                  isFull={storageStatus?.isFull || false}
                  purchasing={purchasing}
                  hasDiscount={weaponWorkshopLevel > 0}
                  discountPercent={calculateWeaponWorkshopDiscount(weaponWorkshopLevel)}
                  onWeaponClick={(weapon) => setSelectedWeapon(weapon as Weapon)}
                  ownedWeapons={ownedWeapons}
                />
              </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
              <WeaponCardGrid
                processedWeapons={processedWeapons}
                groupedWeapons={groupedWeapons}
                userCurrency={user?.currency || 0}
                weaponWorkshopLevel={weaponWorkshopLevel}
                storageStatus={storageStatus}
                purchasing={purchasing}
                ownedWeapons={ownedWeapons}
                selectedForComparison={selectedForComparison}
                calculateDiscountedPrice={calculateDiscountedPrice}
                getTypeColor={getTypeColor}
                getAttributeBonuses={getAttributeBonuses}
                getLoadoutTypeLabel={getLoadoutTypeLabel}
                getLoadoutTypeColor={getLoadoutTypeColor}
                onPurchase={handlePurchase}
                onToggleComparison={toggleComparison}
                onSelectWeapon={setSelectedWeapon}
              />
            )}
          </>
        )}

        {/* Comparison Bar */}
        <ComparisonBar
          selectedCount={selectedForComparison.length}
          onCompare={handleCompare}
          onClear={handleClearComparison}
        />

        {/* Comparison Modal */}
        {showComparisonModal && (
          <ComparisonModal
            weapons={weapons.filter(w => selectedForComparison.includes(w.id))}
            onClose={() => setShowComparisonModal(false)}
            onPurchase={(weaponId) => {
              const weapon = weapons.find(w => w.id === weaponId);
              if (weapon) {
                handlePurchase(weaponId, weapon.cost);
              }
            }}
            onRemove={handleRemoveFromComparison}
            userCurrency={user?.currency || 0}
            weaponWorkshopLevel={weaponWorkshopLevel}
            storageIsFull={storageStatus?.isFull || false}
            purchasingId={purchasing}
          />
        )}

        {/* Weapon Detail Modal */}
        {selectedWeapon && (
          <WeaponDetailModal
            weapon={selectedWeapon}
            onClose={() => setSelectedWeapon(null)}
            onPurchase={handlePurchase}
            calculateDiscountedPrice={calculateDiscountedPrice}
            userCredits={user?.currency || 0}
            isFull={storageStatus?.isFull || false}
            purchasing={purchasing === selectedWeapon.id}
            hasDiscount={weaponWorkshopLevel > 0}
            discountPercent={calculateWeaponWorkshopDiscount(weaponWorkshopLevel)}
            ownedCount={ownedWeapons.get(selectedWeapon.id) || 0}
          />
        )}

        {/* Confirmation Modal */}
        {confirmationModal.isOpen && (
          <ConfirmationModal
            title={confirmationModal.title}
            message={confirmationModal.message}
            confirmLabel={confirmationModal.title === 'Confirm Purchase' ? 'Purchase' : 'OK'}
            cancelLabel="Cancel"
            onConfirm={confirmationModal.onConfirm}
            onCancel={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
          />
        )}
      </div>
    </div>
  );
}

export default WeaponShopPage;
