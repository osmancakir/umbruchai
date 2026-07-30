import { expect, test } from '@playwright/test'

test('the home page renders', async ({ page }) => {
	const response = await page.goto('/')
	expect(response?.status()).toBe(200)
	await expect(
		page.getByRole('link', { name: /umbruch/i }).first(),
	).toBeVisible()
})

test('an unknown route renders the not found boundary', async ({ page }) => {
	const response = await page.goto('/this-route-does-not-exist')
	expect(response?.status()).toBe(404)
	await expect(page.getByText(/we can't find this page/i)).toBeVisible()
})
