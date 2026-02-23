# Facilities Tab Consolidation - Step by Step Plan

## Goal
Combine "Investments & ROI" tab from `/income` and `/facility-advisor` page into tabs under `/facilities`

## Current State
- Frontend builds successfully (with some non-blocking TypeScript warnings)
- FacilitiesPage.tsx is clean and working
- Need to add tab interface to FacilitiesPage

## Steps to Execute

### Step 1: Add Tab Interface to FacilitiesPage ✅ NEXT
Add imports, state, and tab navigation UI

### Step 2: Add Investments Tab Content
Move FacilityROICalculator and investment tips to new tab

### Step 3: Add Advisor Tab Content  
Move recommendations and ROI analysis from FacilityInvestmentAdvisorPage

### Step 4: Remove Investments Tab from FinancialReportPage
Remove the investments tab option

### Step 5: Remove /facility-advisor Route
Delete route from App.tsx

### Step 6: Update Navigation
Remove facility-advisor link from navigation menu

### Step 7: Clean Up
Delete unused files and verify build

## Status: Ready to Start
