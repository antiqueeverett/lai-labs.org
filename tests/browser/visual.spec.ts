import { test, expect } from '@playwright/test'

// Baselines are reviewed, platform-specific artifacts. CI must never update them.
// These bounded surfaces avoid animated hero content without masking navigation or contact UI.
test('approved navigation and contact surfaces @visual', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/contact/')
  await page.evaluate(() => document.fonts.ready)
  const header = page.getByRole('banner')
  if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await expect(header.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(isMobile ? header.getByRole('navigation', { name: 'Primary' }) : header).toHaveScreenshot('navigation.png')
  if (isMobile) await page.getByRole('button', { name: 'Close menu', exact: true }).click()
  const contact = page.locator('.contact-cta-card')
  await contact.scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  // Keep the card fully visible away from the scroll limit and header; avoid fractional centering.
  await contact.evaluate(element => window.scrollTo(0, Math.floor(element.getBoundingClientRect().top + window.scrollY) - 200))
  await expect(contact).toHaveCSS('transform', 'none')
  await expect(contact.getByRole('heading', { name: 'Continue the conversation' })).toBeVisible()
  await expect(contact.getByText('Choose the focus, then continue by email. Call scheduling is not yet available.', { exact: true })).toBeVisible()
  await expect(contact).toHaveScreenshot('contact.png')
})
