# E2E Test Plan for Autosave Feature

## Overview
This document outlines the E2E tests that should be implemented using Playwright or Cypress to fully validate the autosave functionality in a real browser environment.

## Prerequisites
- Install Playwright: `npm install -D @playwright/test`
- Configure Playwright for the project
- Ensure dev server can run during tests

## Test Suite: Autosave E2E Tests

### Test 1: Basic Session Restoration
```javascript
test('should restore session after page reload', async ({ page }) => {
  // 1. Navigate to the app
  await page.goto('http://localhost:5173');
  
  // 2. Upload a transcript
  await page.getByLabel('Upload or Drag & Drop').setInputFiles('test-data/sample-transcript.txt');
  await expect(page.getByText('sample-transcript.txt')).toBeVisible();
  
  // 3. Wait for autosave (debounce)
  await page.waitForTimeout(1500);
  
  // 4. Reload the page
  await page.reload();
  
  // 5. Verify restoration
  await expect(page.getByText('Your previous analysis session has been restored')).toBeVisible();
  await expect(page.getByText('sample-transcript.txt')).toBeVisible();
});
```

### Test 2: Large Data Persistence
```javascript
test('should handle large state (>15MB)', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Upload multiple large transcripts
  const files = Array.from({ length: 20 }, (_, i) => 
    `test-data/large-transcript-${i}.txt`
  );
  await page.getByLabel('Upload or Drag & Drop').setInputFiles(files);
  
  // Process some steps
  await page.getByText('Run Step').click();
  await page.waitForSelector('.step-complete');
  
  // Reload and verify
  await page.reload();
  await expect(page.getByText('Your previous analysis session has been restored')).toBeVisible();
  await expect(page.locator('.transcript-item')).toHaveCount(20);
});
```

### Test 3: Start New Session
```javascript
test('should clear data when starting new session', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Upload and process
  await page.getByLabel('Upload or Drag & Drop').setInputFiles('test-data/sample.txt');
  await page.reload();
  
  // Click "Start New Session"
  await page.getByRole('button', { name: 'Start New Session' }).click();
  
  // Verify data cleared
  await expect(page.getByText('Upload transcripts to begin')).toBeVisible();
  
  // Reload should not restore
  await page.reload();
  await expect(page.getByText('Your previous analysis session has been restored')).not.toBeVisible();
});
```

### Test 4: Private Browsing Mode
```javascript
test('should handle private browsing gracefully', async ({ browser }) => {
  const context = await browser.newContext({ 
    storageState: undefined,
    // Simulate private mode by disabling storage
  });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173');
  
  // App should still function
  await page.getByLabel('Upload or Drag & Drop').setInputFiles('test-data/sample.txt');
  await expect(page.getByText('sample.txt')).toBeVisible();
  
  // Check console for errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  await page.reload();
  expect(errors).toHaveLength(0);
});
```

### Test 5: Cross-Tab Synchronization (Future Enhancement)
```javascript
test.skip('should sync state across tabs', async ({ browser }) => {
  // This test is for a future enhancement where multiple tabs
  // could share the same session state
});
```

## Running the Tests

```bash
# Run all E2E tests
npx playwright test e2e/

# Run in headed mode to see the browser
npx playwright test e2e/ --headed

# Run specific test file
npx playwright test e2e/autosave.e2e.spec.js
```

## CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Run E2E tests
  run: |
    npm run dev &
    npx wait-on http://localhost:5173
    npx playwright test e2e/
```