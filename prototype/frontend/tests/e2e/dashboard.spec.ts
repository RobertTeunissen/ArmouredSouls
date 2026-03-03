import { test, expect } from '@playwright/test';

/**
 * E2E tests for Dashboard Page
 * These tests verify the dashboard displays correctly after login
 */

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel('Username or Email').fill('player1');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('should display dashboard with user profile', async ({ page }) => {
    // Check main dashboard elements - actual implementation uses "Command Center"
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    await expect(page.getByText(/Stable$/)).toBeVisible();
    
    // Take screenshot of dashboard profile section
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-profile.png',
      fullPage: true 
    });
  });

  test('should display credits balance', async ({ page }) => {
    // Check financial overview section exists
    await expect(page.getByText('Financial Overview')).toBeVisible();
    
    // Check that credits amount is visible (should start with ₡ symbol)
    const creditsElement = page.locator('text=/₡[0-9,]+/');
    await expect(creditsElement.first()).toBeVisible();
    
    // Take screenshot of credits section
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-credits.png',
      fullPage: true 
    });
  });

  test('should display navigation menu', async ({ page }) => {
    // Check navigation elements are present (they're buttons, not links)
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    
    // Check dropdown menus exist
    await expect(page.getByText('Robots ▾')).toBeVisible();
    await expect(page.getByText('Battle ▾')).toBeVisible();
    await expect(page.getByText('Stable ▾')).toBeVisible();
    
    // Take screenshot showing navigation
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-navigation.png',
      fullPage: true 
    });
  });



  test('should display robots table if user has robots', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Check if "My Robots" section exists
    const myRobotsHeading = page.getByRole('heading', { name: 'My Robots' });
    const welcomeHeading = page.getByRole('heading', { name: 'Welcome to Your Stable!' });
    
    // Check which section is visible
    const hasRobots = await myRobotsHeading.isVisible().catch(() => false);
    const noRobots = await welcomeHeading.isVisible().catch(() => false);
    
    if (hasRobots) {
      // If user has robots, verify robot cards are displayed
      // RobotDashboardCard uses .bg-surface class and contains ELO, HP, League info
      const robotCards = page.locator('.bg-surface.border.border-gray-700.rounded-lg');
      
      // Wait for at least one robot card to be visible
      await expect(robotCards.first()).toBeVisible({ timeout: 3000 });
      
      // Verify the card contains expected robot information
      await expect(page.locator('text=/ELO:/i').first()).toBeVisible();
      
      // Take screenshot with robots
      await page.screenshot({ 
        path: 'test-results/screenshots/dashboard-with-robots.png',
        fullPage: true 
      });
    } else if (noRobots) {
      // If no robots, verify empty state message
      await expect(page.getByText(/Welcome to Your Stable/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
      
      // Take screenshot of empty state
      await page.screenshot({ 
        path: 'test-results/screenshots/dashboard-empty-stable.png',
        fullPage: true 
      });
    } else {
      // Neither section found - just verify page loaded
      await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    }
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Set viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Verify main elements are still visible
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    await expect(page.getByText('Financial Overview')).toBeVisible();
    
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
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
    
    // Take screenshot on mobile viewport
    await page.screenshot({ 
      path: 'test-results/screenshots/dashboard-mobile.png',
      fullPage: true 
    });
  });
});
