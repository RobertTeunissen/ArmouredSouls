import { test, expect } from '@playwright/test';

/**
 * E2E tests for Dashboard Page
 * These tests verify the dashboard displays correctly after login
 */

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel('Username').fill('player1');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should display dashboard with user profile', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Username:')).toBeVisible();
    await expect(page.getByText('player1')).toBeVisible();
    await expect(page.getByText('Role:')).toBeVisible();
    
    // Take screenshot of dashboard profile section
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-profile.png',
      fullPage: true 
    });
  });

  test('should display credits balance', async ({ page }) => {
    // Check credits section
    await expect(page.getByRole('heading', { name: 'Credits Balance' })).toBeVisible();
    await expect(page.getByText('Available Credits')).toBeVisible();
    
    // Check that credits amount is visible (should start with ₡ symbol)
    const creditsElement = page.locator('text=/₡[0-9,]+/');
    await expect(creditsElement).toBeVisible();
    
    // Take screenshot of credits section
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-credits.png',
      fullPage: true 
    });
  });

  test('should display navigation menu', async ({ page }) => {
    // Check navigation elements are present
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Facilities' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Robots' })).toBeVisible();
    
    // Take screenshot showing navigation
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-navigation.png',
      fullPage: true 
    });
  });

  test('should display quick action buttons', async ({ page }) => {
    // Check quick action buttons
    await expect(page.getByRole('button', { name: /Upgrade Facilities/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage Robots|Create Robot/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Battle Arena/i })).toBeVisible();
    
    // Take screenshot of quick actions
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-quick-actions.png',
      fullPage: true 
    });
  });

  test('should navigate to facilities page from quick action', async ({ page }) => {
    // Click on Upgrade Facilities button
    await page.getByRole('button', { name: /Upgrade Facilities/i }).click();
    
    // Wait for navigation
    await page.waitForURL('**/facilities', { timeout: 5000 });
    
    // Verify we're on facilities page
    await expect(page).toHaveURL(/.*facilities/);
    
    // Take screenshot of facilities page
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-navigate-to-facilities.png',
      fullPage: true 
    });
  });

  test('should navigate to robots page from quick action', async ({ page }) => {
    // Click on Manage Robots/Create Robot button
    await page.getByRole('button', { name: /Manage Robots|Create Robot/i }).click();
    
    // Wait for navigation
    await page.waitForURL('**/robots', { timeout: 5000 });
    
    // Verify we're on robots page
    await expect(page).toHaveURL(/.*robots/);
    
    // Take screenshot of robots page
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-navigate-to-robots.png',
      fullPage: true 
    });
  });

  test('should display robots table if user has robots', async ({ page }) => {
    // Check if "My Robots" section exists
    const myRobotsHeading = page.getByRole('heading', { name: 'My Robots' });
    const yourStableHeading = page.getByRole('heading', { name: 'Your Stable' });
    
    // Check which section is visible
    const hasRobots = await myRobotsHeading.isVisible().catch(() => false);
    const noRobots = await yourStableHeading.isVisible().catch(() => false);
    
    if (hasRobots) {
      // If user has robots, verify table headers
      await expect(page.getByText('Name', { exact: true })).toBeVisible();
      await expect(page.getByText('ELO')).toBeVisible();
      await expect(page.getByText('Wins')).toBeVisible();
      await expect(page.getByText('Losses')).toBeVisible();
      
      // Take screenshot with robots
      await page.screenshot({ 
        path: 'test-results/screenshots/dashboard-with-robots.png',
        fullPage: true 
      });
    } else if (noRobots) {
      // If no robots, verify empty state message
      await expect(page.getByText(/Your stable is empty/i)).toBeVisible();
      
      // Take screenshot of empty state
      await page.screenshot({ 
        path: 'test-results/screenshots/dashboard-empty-stable.png',
        fullPage: true 
      });
    }
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Set viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Verify main elements are still visible
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Credits Balance' })).toBeVisible();
    
    // Take screenshot on tablet viewport
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-tablet.png',
      fullPage: true 
    });
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify main elements are still visible
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    
    // Take screenshot on mobile viewport
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-mobile.png',
      fullPage: true 
    });
  });
});
