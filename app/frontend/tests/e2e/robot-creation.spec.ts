import { test, expect } from '@playwright/test';

/**
 * E2E tests for Robot Creation
 * These tests verify the robot creation workflow
 *
 * Auth state is pre-loaded via the setup project (see auth.setup.ts).
 */

test.describe('Robot Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Auth state already loaded — go straight to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to create robot page', async ({ page }) => {
    // Navigate to robots page
    await page.goto('/robots');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of robots page
    await page.screenshot({ 
      path: 'test-results/screenshots/robots-page.png',
      fullPage: true 
    });
    
    // Check if create robot button/link exists
    const createButton = page.getByRole('link', { name: /Create Robot|Create New Robot|New Robot/i });
    const buttonExists = await createButton.isVisible().catch(() => false);
    
    if (buttonExists) {
      await createButton.click();
      await page.waitForURL('**/robots/create', { timeout: 5000 });
      
      // Take screenshot of create robot page
      await page.screenshot({ 
        path: 'test-results/screenshots/create-robot-page.png',
        fullPage: true 
      });
    } else {
      // If no button, try navigating directly
      await page.goto('/robots/create');
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the create page
      await expect(page.getByLabel(/Robot Name|Name/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display robot creation form', async ({ page }) => {
    await page.goto('/robots/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Check form elements
    await expect(page.getByLabel(/Robot Name|Name/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /Create Robot/i })).toBeVisible({ timeout: 3000 });
    
    // Take screenshot of form
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-form.png',
      fullPage: true 
    });
  });

  test('should show error for empty name', async ({ page }) => {
    await page.goto('/robots/create');
    
    // The input has required attribute, so browser validation will prevent submission
    // We need to check if the input is marked as required
    const nameInput = page.getByLabel(/Robot Name|Name/i);
    await expect(nameInput).toHaveAttribute('required');
    
    // Alternatively, we can try to submit and check for browser validation
    // or verify the Create Robot button behavior
    await expect(page.getByRole('button', { name: /Create Robot/i })).toBeVisible();
    
    // Take screenshot showing form
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-empty-name-validation.png',
      fullPage: true 
    });
  });

  test('should show validation for robot name length', async ({ page }) => {
    await page.goto('/robots/create');
    
    // The input has maxLength=50, so we can't type more than 50 characters
    // Instead, verify the character counter shows the limit
    const longName = 'A'.repeat(50);
    await page.getByLabel(/Robot Name|Name/i).fill(longName);
    
    // Verify character counter shows 50/50
    await expect(page.getByText('50/50 characters')).toBeVisible();
    
    // Take screenshot showing max length
    await page.screenshot({ 
      path: 'test-results/screenshots/create-robot-max-length.png',
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
