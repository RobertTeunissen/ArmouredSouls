import { test, expect } from '@playwright/test';

/**
 * E2E tests for Robot Creation
 * These tests verify the robot creation workflow
 */

test.describe('Robot Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel('Username').fill('player1');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should navigate to create robot page', async ({ page }) => {
    // Navigate to robots page
    await page.goto('/robots');
    
    // Take screenshot of robots page
    await page.screenshot({ 
      path: 'test-results/screenshots/robots-page.png',
      fullPage: true 
    });
    
    // Click create robot button if it exists
    const createButton = page.getByRole('link', { name: /Create Robot|Create New Robot/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForURL('**/robots/create', { timeout: 5000 });
      
      // Take screenshot of create robot page
      await page.screenshot({ 
        path: 'test-results/screenshots/create-robot-page.png',
        fullPage: true 
      });
    }
  });

  test('should display robot creation form', async ({ page }) => {
    await page.goto('/robots/create');
    
    // Check form elements
    await expect(page.getByLabel(/Robot Name|Name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Robot/i })).toBeVisible();
    
    // Take screenshot of form
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-form.png',
      fullPage: true 
    });
  });

  test('should show error for empty name', async ({ page }) => {
    await page.goto('/robots/create');
    
    // Try to submit without name
    await page.getByRole('button', { name: /Create Robot/i }).click();
    
    // Wait for error message
    await expect(page.getByText(/Robot name is required/i)).toBeVisible({
      timeout: 2000
    });
    
    // Take screenshot showing error
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-empty-name-error.png',
      fullPage: true 
    });
  });

  test('should show validation for robot name length', async ({ page }) => {
    await page.goto('/robots/create');
    
    // Fill with very long name
    const longName = 'A'.repeat(101);
    await page.getByLabel(/Robot Name|Name/i).fill(longName);
    
    // Take screenshot before submit
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-long-name.png',
      fullPage: true 
    });
    
    await page.getByRole('button', { name: /Create Robot/i }).click();
    
    // Wait for validation error
    await expect(page.getByText(/must be 100 characters or less/i)).toBeVisible({
      timeout: 2000
    });
    
    // Take screenshot showing validation error
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-name-too-long-error.png',
      fullPage: true 
    });
  });

  test('should display cost information', async ({ page }) => {
    await page.goto('/robots/create');
    
    // Check that cost is displayed
    const costText = page.locator('text=/₡[0-9,]+|500,000|cost/i');
    await expect(costText.first()).toBeVisible({ timeout: 2000 });
    
    // Take screenshot showing cost
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-cost-display.png',
      fullPage: true 
    });
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/robots/create');
    
    // Check form is still accessible
    await expect(page.getByLabel(/Robot Name|Name/i)).toBeVisible();
    
    // Take screenshot on mobile
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-mobile.png',
      fullPage: true 
    });
  });
});
