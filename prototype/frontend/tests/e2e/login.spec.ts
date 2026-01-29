import { test, expect } from '@playwright/test';

/**
 * E2E tests for Login Page
 * These tests verify the login functionality and capture screenshots
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page before each test
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    // Check that main elements are visible
    await expect(page.getByRole('heading', { name: 'Armoured Souls' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    
    // Take screenshot of initial login page
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page-initial.png',
      fullPage: true 
    });
  });

  test('should show test accounts information', async ({ page }) => {
    // Verify test accounts section is visible
    await expect(page.getByText('Test Accounts:')).toBeVisible();
    await expect(page.getByText('admin / admin123')).toBeVisible();
    await expect(page.getByText('player1 / password123')).toBeVisible();
    
    // Take screenshot showing test accounts
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page-test-accounts.png',
      fullPage: true 
    });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Try to login with invalid credentials
    await page.getByLabel('Username').fill('invalid_user');
    await page.getByLabel('Password').fill('wrong_password');
    
    // Take screenshot before clicking login
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page-before-invalid-submit.png',
      fullPage: true 
    });
    
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Wait for error message
    await expect(page.getByText(/Login failed|Invalid credentials/i)).toBeVisible({
      timeout: 5000
    });
    
    // Take screenshot showing error state
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page-error-state.png',
      fullPage: true 
    });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill in valid credentials
    await page.getByLabel('Username').fill('player1');
    await page.getByLabel('Password').fill('password123');
    
    // Take screenshot before login
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page-before-valid-submit.png',
      fullPage: true 
    });
    
    // Click login button
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Take screenshot of dashboard after successful login
    await page.screenshot({ 
      path: 'test-results/screenshots/login-success-dashboard.png',
      fullPage: true 
    });
  });

  test('should have responsive design on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/login');
    
    // Check elements are still visible
    await expect(page.getByRole('heading', { name: 'Armoured Souls' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    
    // Take screenshot on mobile viewport
    await page.screenshot({ 
      path: 'test-results/screenshots/login-page-mobile.png',
      fullPage: true 
    });
  });
});
