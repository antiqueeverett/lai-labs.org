import { test, expect } from '@playwright/test'

// Baselines are reviewed, platform-specific artifacts. CI must never update them.
// These bounded surfaces avoid animated hero content without masking navigation or contact UI.
// The fixed dialog exercises the actual form and deferred booking state without scroll-dependent rasterization.
test('approved navigation and contact surfaces @visual', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/contact/')
  await page.evaluate(() => document.fonts.ready)
  const header = page.getByRole('banner')
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await expect(header.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(isMobile ? header.getByRole('navigation', { name: 'Primary' }) : header).toHaveScreenshot('navigation.png')
  const reachOut = isMobile
    ? header.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Reach Out', exact: true })
    : header.locator('.nav-cta').getByRole('button', { name: 'Reach Out', exact: true })
  await reachOut.click()
  const dialog = page.getByRole('dialog', { name: 'Reach out to Label AI' })
  await dialog.getByRole('button', { name: 'Partner', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Deployment Test')
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('test@example.com')
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).blur()
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  await expect(dialog.getByRole('button', { name: 'Schedule a call', exact: true })).toBeDisabled()
  await expect(dialog.getByText('Call scheduling is not yet available. Please continue by email.', { exact: true })).toBeVisible()
  await expect(dialog).toHaveCSS('opacity', '1')
  await expect(dialog).toHaveCSS('transform', 'none')
  await expect(dialog).toHaveScreenshot('contact.png')
})
