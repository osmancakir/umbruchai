import { expect, test } from '@playwright/test'

test('the game moves through its staged setup before play begins', async ({
	page,
}) => {
	const response = await page.goto('/slave')
	expect(response?.status()).toBe(200)

	await expect(page.getByRole('heading', { name: 'SKLAVE' })).toBeVisible()
	await expect(page.getByText('Sei frei / Finde ‚den‘ Sinn')).toBeVisible()
	await page.getByRole('button', { name: 'Start' }).click()

	await expect(
		page.getByRole('heading', {
			name: 'Das Spiel beginnt mit den folgenden Schritten',
		}),
	).toBeVisible()
	await expect(page.getByRole('listitem')).toHaveText([
		'1Einführung',
		'2Bedingungen festlegen',
		'3Spielzeit',
	])

	await page.getByRole('button', { name: 'Weiter' }).click()
	await expect(page.getByRole('heading', { name: 'Einführung' })).toBeVisible()

	await page.getByRole('button', { name: 'Weiter' }).click()
	await expect(
		page.getByRole('heading', { name: 'Restzeit ist alles' }),
	).toBeVisible()
	await expect(
		page.getByText(/Eine Figur besitzt genau einen Wert/),
	).toBeVisible()

	await page.getByRole('button', { name: 'Weiter' }).click()
	await expect(
		page.getByRole('heading', { name: 'Du bestimmst die Bedingungen' }),
	).toBeVisible()
	await expect(page.getByText(/Es gibt keine richtige Antwort/)).toBeVisible()

	await page.getByRole('button', { name: 'Weiter' }).click()
	await expect(
		page.getByRole('heading', { name: 'Bedingungen festlegen' }),
	).toBeVisible()

	await page.getByRole('button', { name: 'Weiter' }).click()
	for (let questionNumber = 1; questionNumber <= 6; questionNumber++) {
		await expect(
			page.getByText(`Frage ${String(questionNumber).padStart(2, '0')} / 06`),
		).toBeVisible()
		await page.getByRole('button', { name: 'Weiter' }).click()
	}

	await expect(page.getByRole('heading', { name: 'Spielzeit' })).toBeVisible()
	await expect(
		page.getByText(/Jetzt beginnt dein Leben in der postmodernen Zeit/),
	).toBeVisible()
	await expect(page.getByText('Dein Modus ist:')).toBeVisible()
	await expect(page.getByText('MITTELSCHICHT')).toBeVisible()
	await expect(
		page.getByText('Kapitel 1 — Du musst 100 Tage überleben.'),
	).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Leben starten' }),
	).toBeVisible()

	await page.getByRole('button', { name: 'Zurück' }).click()
	await expect(page.getByText('Frage 06 / 06')).toBeVisible()
})
