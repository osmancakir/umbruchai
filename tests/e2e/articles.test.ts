import { expect, test } from '@playwright/test'

/**
 * These run against the live Sanity dataset — the magazine has no fixtures, and
 * the thing worth testing is that a real article survives the trip from GROQ to
 * the page. They assert on structure, never on the wording of any one article.
 */

test('the front page leads with a story that opens', async ({ page }) => {
	await page.goto('/')

	const lead = page.getByRole('article').first()
	await expect(lead).toBeVisible()

	const headline = await lead.getByRole('heading').first().textContent()
	await lead.getByRole('link').first().click()

	await expect(page).toHaveURL(/\/articles\/[^/]+$/)
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		headline?.trim() ?? '',
	)
})

test('every article ships its colophon', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('article').first().getByRole('link').first().click()

	await expect(page.getByText('// Herstellung')).toBeVisible()
	// The honesty line is the one entry that is never allowed to go missing.
	await expect(page.getByText('human_review')).toBeVisible()
	await expect(page.getByText(/geprüft/)).toBeVisible()
})

test('switching reading level rewrites the article in place', async ({
	page,
}) => {
	await page.goto('/')
	await page.getByRole('article').first().getByRole('link').first().click()

	// The quiz belongs to the level, so its first answer option is the cheapest
	// proof that the whole level swapped and not just the headline.
	const firstOption = page
		.getByRole('region', { name: 'Verstanden?' })
		.getByRole('button')
		.first()
	const easyOption = await firstOption.textContent()

	await page.getByRole('radio', { name: 'Fortgeschritten' }).click()

	await expect(page).toHaveURL(/level=advanced/)
	await expect(
		page.getByRole('radio', { name: 'Fortgeschritten' }),
	).toHaveAttribute('aria-checked', 'true')
	await expect(firstOption).not.toHaveText(easyOption ?? '')
})

test('an agent byline leads to that agent’s profile', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('article').first().getByRole('link').first().click()

	await page.getByRole('link', { name: /· Agent|· Autor/ }).first().click()

	await expect(page).toHaveURL(/\/articles\/authors\//)
	await expect(page.getByText('Agentenprofil')).toBeVisible()
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('filtering by ressort narrows the archive', async ({ page }) => {
	await page.goto('/')

	const kultur = page
		.getByRole('group', { name: 'Ressort' })
		.getByRole('button', { name: 'Kultur' })
	await kultur.click()

	await expect(page).toHaveURL(/category=culture/)
	await expect(kultur).toHaveAttribute('aria-pressed', 'true')
	// Agency and Richtung are political-desk filters and must stay hidden here.
	await expect(page.getByRole('radiogroup', { name: 'Agency' })).toHaveCount(0)

	// The chip is a toggle — clicking it again returns to the full archive.
	await kultur.click()

	await expect(page).not.toHaveURL(/category=/)
	await expect(kultur).toHaveAttribute('aria-pressed', 'false')
})

test('an unknown article slug 404s', async ({ page }) => {
	const response = await page.goto('/articles/kein-artikel-mit-diesem-slug')
	expect(response?.status()).toBe(404)
})
