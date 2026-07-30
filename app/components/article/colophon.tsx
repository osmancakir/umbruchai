import {
	formatIsoMinute,
	type roleLabels,
	toAgentHandle,
} from '#app/utils/articles.ts'
import { type Article } from '#app/utils/articles.types.ts'
import { Colophon, type ColophonEntry } from '../colophon.tsx'

const PIPELINE_STEPS: Record<string, string> = {
	author: 'entwurf',
	factChecker: 'faktencheck',
	editor: 'redaktion',
}

/**
 * §06: every article ends with a machine-readable account of how it was made,
 * and it is built from the article's own record — never hand-written, never
 * approximated. Where the data is silent the line is simply absent; the one
 * line that is never absent is `human_review`.
 */
export function ArticleColophon({
	article,
	className,
}: {
	article: Article
	className?: string
}) {
	const entries: ColophonEntry[] = []

	const agents = article.agents ?? []
	if (agents.length > 0) {
		entries.push({
			key: 'agent',
			value: agents.map((author) => toAgentHandle(author.name)).join(' · '),
		})
	}

	const models = article.aiAuthor ?? []
	if (models.length > 0) {
		entries.push({
			key: 'model',
			value: models
				.map((model) => {
					const name = model.name.toLowerCase()
					const version = model.version?.toLowerCase()
					// Most migrated model names already carry their version
					// (`claude-opus-4-8` / `4.8`); only append one that adds something.
					const isRedundant =
						!version ||
						name.replace(/[.-]/g, '').includes(version.replace(/[.-]/g, ''))
					return isRedundant ? name : `${name}@${version}`
				})
				.join(' · '),
		})
	}

	// The pipeline is read off the roles that actually worked on the piece,
	// deduplicated and put back in production order.
	const roles = new Set(
		[...models, ...agents].map((contributor) => contributor.role ?? 'author'),
	)
	const steps = ['author', 'factChecker', 'editor']
		.filter((role) => roles.has(role as keyof typeof roleLabels))
		.map((role) => PIPELINE_STEPS[role])
	entries.push({
		key: 'pipeline',
		value: ['recherche', ...steps, 'umbruch'].join(' → '),
	})

	entries.push({
		key: 'sources',
		value: `${article.sources?.length ?? 0} geprüft`,
	})

	const humanContributors = agents.filter((author) => author.entity === 'human')
	entries.push({
		key: 'human_review',
		value:
			humanContributors.length > 0
				? humanContributors.map((author) => author.name).join(' · ')
				: 'keins — dieser Text ist maschinengemacht',
		signal: humanContributors.length === 0,
	})

	entries.push({ key: 'published', value: formatIsoMinute(article.date) })

	return <Colophon entries={entries} className={className} />
}
