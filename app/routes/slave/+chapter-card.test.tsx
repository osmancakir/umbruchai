/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { ChapterCard } from './index.tsx'

function ChapterEnding() {
	const [view, setView] = useState<'ending' | 'coming-soon'>('ending')
	return <ChapterCard view={view} onContinue={() => setView('coming-soon')} />
}

test('chapter one ending continues to the chapter two coming-soon card', async () => {
	const user = userEvent.setup()
	render(<ChapterEnding />)

	expect(
		screen.getByRole('heading', {
			name: 'Du hast es geschafft, Sklave. Bravo.',
		}),
	).toBeVisible()
	expect(
		screen.getByText('Jetzt frag dich: Was war der Sinn von alledem?'),
	).toBeVisible()

	await user.click(screen.getByRole('button', { name: 'Weiter zu Kapitel 2' }))

	expect(screen.getByText('Kapitel 2')).toBeVisible()
	expect(screen.getByRole('heading', { name: 'Demnächst' })).toBeVisible()
	expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
