# Facilities Tab Consolidation

## Summary
Consolidating the "Investments & ROI" tab from `/income` and `/facility-advisor` page into tabs under `/facilities`.

## Changes Required

### 1. FacilitiesPage.tsx - Add Tab Interface
**File**: `prototype/frontend/src/pages/FacilitiesPage.tsx`

**Changes**:
- Add tab state: `const [activeTab, setActiveTab] = useState<TabType>('facilities')`
- Add advisor state variables for ROI data and recommendations
- Add `fetchAdvisorData()` function
- Add helper functions: `getFacilityDisplayName()`, `getROIColor()`
- Add tab navigation UI with 3 tabs:
  - "Facilities & Upgrades" (existing content)
  - "Investments & ROI" (from InvestmentsTab component)
  - "Investment Advisor" (from FacilityInvestmentAdvisorPage)
- Split render into 3 functions:
  - `renderFacilitiesContent()` - existing facilities grid
  - `renderInvestmentsContent()` - ROI calculator + tips
  - `renderAdvisorContent()` - recommendations + current ROI

### 2. Remove Investments Tab from FinancialReportPage
**File**: `prototype/frontend/src/pages/FinancialReportPage.tsx`

**Remove**:
- 'investments' from TabType
- Investments tab button from navigation
- Investments tab content rendering
- Import of InvestmentsTab component

### 3. Remove /facility-advisor Route
**File**: `prototype/frontend/src/App.tsx`

**Remove**:
- Route for `/facility-advisor`
- Import of FacilityInvestmentAdvisorPage

### 4. Update Navigation
**File**: `prototype/frontend/src/components/Navigation.tsx`

**Remove**:
- `/facility-advisor` from protected routes list
- "Facility Advisor" menu item from Analytics menu

### 5. Delete Unused Files
- `prototype/frontend/src/pages/FacilityInvestmentAdvisorPage.tsx`
- `prototype/frontend/src/components/InvestmentsTab.tsx` (content moved to FacilitiesPage)

## Benefits
- Single location for all facility-related features
- Better user experience with related features grouped together
- Reduced navigation complexity
- Easier to find ROI and investment information

## Status
- ⏳ In Progress
- Need to complete FacilitiesPage.tsx modifications
- Need to update FinancialReportPage.tsx
- Need to update App.tsx and Navigation.tsx
- Need to delete unused files
