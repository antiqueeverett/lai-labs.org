import { test, expect, type Page } from '@playwright/test'

// Independent user-facing expectations: do not derive these from App or the route generator.
const routes = [
  ['/', 'From problem definition to controlled production', 'Performance and limits evaluated in context.'],
  ['/solutions/', 'Handover begins at design', 'Independent operation is planned from the start'],
  ['/industries/', 'The application sets the technical path', 'The benchmark comes before the model'],
  ['/impact/', 'We measure success by what', 'institutions can do without us'],
  ['/partnerships/', 'Engagement models for', 'long-term collaboration'],
  ['/about/', 'People before abstractions', 'One technical standard across different contexts'],
  ['/contact/', 'Clarify the objective', 'Align on what comes next'],
] as const

async function expectRouteContent(page: Page, title: string, subtitle: string) {
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveCount(1)
  await expect(heading).toBeVisible()
  await expect(heading).toContainText(title)
  await expect(heading).toContainText(subtitle)
}

for (const [route, title, subtitle] of routes) {
  test(`direct route, assets, layout and refresh: ${route}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`))
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
    const response = await page.goto(route)
    expect(response?.status()).toBe(200)
    await expect(page.locator('main')).toBeVisible()
    await expectRouteContent(page, title, subtitle)
    await page.evaluate(async () => {
      for (const image of Array.from(document.images)) {
        image.loading = 'eager'
        await image.decode()
      }
      await document.fonts.ready
    })
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < height; y += 600) {
      await page.evaluate(y => window.scrollTo(0, y), y)
      await page.waitForTimeout(300)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(900)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll('/', '') || 'home'}.png`), fullPage: true })
    expect((await page.reload())?.status()).toBe(200)
    await expectRouteContent(page, title, subtitle)
    await expect(page.locator('footer')).toBeAttached()
    expect(errors).toEqual([])
  })
}

test('unknown document returns a real HTTP 404', async ({ request }) => {
  const response = await request.get('/deployment-check-missing-page/')
  expect(response.status()).toBe(404)
})

test('navigation, mobile menu, footer home link and browser history', async ({ page, isMobile }) => {
  await page.goto('/')
  for (const [label, path] of [['Services', '/solutions'], ['Applications', '/industries'], ['About', '/about']]) {
    if (isMobile) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}/?$`))
    if (isMobile) await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible()
  }
  await page.goBack()
  await expect(page).toHaveURL(/\/industries\/?$/)
  await page.locator('footer').getByRole('link', { name: 'Label AI home', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('application selectors, service tabs and keyboard segmentation control', async ({ page }) => {
  await page.goto('/industries/')
  const contexts = page.getByRole('group', { name: 'Application contexts' })
  for (const button of await contexts.getByRole('button').all()) {
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.application-context-main img')).toBeVisible()
    await page.locator('.application-context-main img').evaluate((img: HTMLImageElement) => img.decode())
  }
  const slider = page.getByRole('slider')
  await slider.scrollIntoViewIfNeeded()
  await slider.focus()
  await page.keyboard.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '100')
  await page.keyboard.press('Home')
  await expect(slider).toHaveAttribute('aria-valuenow', '0')
  await page.goto('/solutions/')
  for (const tab of await page.getByRole('tab').all()) {
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toBeVisible()
  }
})

async function openContact(page: Page, intent = 'Build AI') {
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Open menu', exact: true })
  if (await menu.isVisible()) {
    await menu.click()
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Reach Out', exact: true }).click()
  } else {
    await page.locator('.nav-cta').getByRole('button', { name: 'Reach Out', exact: true }).click()
  }
  await page.getByRole('button', { name: intent, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue by email' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Deployment Test')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('invalid')
  await expect(page.getByRole('button', { name: 'Continue by email' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('deployment-test@example.com')
}

test('intercepted email UI success and failure (provider delivery is not tested)', async ({ page }) => {
  let status = 500
  let payload = ''
  await page.route('https://formspree.io/f/xeebypqv', async route => {
    payload = route.request().postData() || ''
    await route.fulfill({ status, contentType: 'application/json', body: status === 200 ? '{"ok":true}' : '{"error":"test failure"}' })
  })
  await openContact(page)
  await page.getByRole('button', { name: 'Continue by email' }).click()
  await expect(page.getByRole('alert')).toContainText('Something went wrong')
  await expect(page.getByRole('heading', { name: 'Thanks' })).toHaveCount(0)
  status = 200
  await page.getByRole('button', { name: 'Continue by email' }).click()
  await expect(page.getByRole('status')).toContainText('Thanks, Deployment')
  expect(payload).toContain('deployment-test@example.com')
  expect(payload).toContain('Build AI')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('calendar booking is visibly deferred and cannot submit', async ({ page }) => {
  let requests = 0
  await page.route('**/api/**', async route => { requests++; await route.abort() })
  await openContact(page, 'Partner')
  await expect(page.getByRole('button', { name: 'Schedule a call', exact: true })).toBeDisabled()
  await expect(page.getByText('Call scheduling is not yet available. Please continue by email.', { exact: true })).toBeVisible()
  await expect(page.locator('.reachout-calendar-panel')).toHaveCount(0)
  expect(requests).toBe(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
