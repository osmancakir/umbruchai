import { expect, test } from '@playwright/test'

test('the front page leads to the application page', async ({ page }) => {
	await page.goto('/')
	await page
		.getByRole('link', { name: 'Bewerbung SZ' })
		.filter({ visible: true })
		.click()

	await expect(page).toHaveURL(/\/bewerbung-sz$/)
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		/Prüfen, einordnen,\s*verständlich machen\./,
	)
})

test('the application page holds every part of the application', async ({
	page,
}) => {
	const response = await page.goto('/bewerbung-sz')
	expect(response?.status()).toBe(200)

	for (const title of [
		'Vorstellungsvideo',
		'Warum ich mich bewerbe',
		'Was Sie suchen, was ich mitbringe',
		'Arbeitsproben',
		'Was ich noch lernen will',
	]) {
		await expect(
			page.getByRole('heading', { level: 2, name: title }),
		).toBeVisible()
	}
	await expect(page.getByText('// Herstellung')).toBeVisible()
})

test('the intro video only reaches YouTube after a click', async ({ page }) => {
	await page.goto('/bewerbung-sz')

	const player = page.getByTitle('Vorstellungsvideo von Osman Cakir')
	await expect(player).toHaveCount(0)

	await page.getByRole('button', { name: /Video abspielen/ }).click()
	await expect(player).toHaveAttribute(
		'src',
		/^https:\/\/www\.youtube-nocookie\.com\/embed\//,
	)
})

test('the game is gone', async ({ page }) => {
	const response = await page.goto('/slave')
	expect(response?.status()).toBe(404)
})
