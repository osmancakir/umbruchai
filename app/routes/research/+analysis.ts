type CompassAxis = 'economic' | 'social'
type AxisDirection = -1 | 1

export type AnalysisAnswerAbbreviation = 'SD' | 'D' | 'A' | 'SA'

export type AnalysisModel = {
	id: string
	name: string
	slug: string
}

export type AnalysisQuestion = {
	id: string
	canonicalText: string
	theme: string
}

export type AnalysisAnswer = {
	abbreviation: AnalysisAnswerAbbreviation
}

export type AnalysisAnswersByLanguage<TLanguage extends string> = Record<
	TLanguage,
	Record<string, Record<string, AnalysisAnswer>>
>

type ModelAxisAggregation = {
	economic: { sum: number; answeredQuestions: number }
	social: { sum: number; answeredQuestions: number }
	totalAnsweredQuestions: number
}

export type CompassModelPoint = {
	modelId: string
	modelName: string
	modelSlug: string
	economicScore: number | null
	socialScore: number | null
	x: number
	y: number
	quadrantLabel: string
	totalAnsweredQuestions: number
	hasCompleteCompass: boolean
}

export type CompassAnalysisResult = {
	modelPoints: CompassModelPoint[]
	mappedQuestionCount: number
	ignoredQuestionCount: number
	axisQuestionCount: Record<CompassAxis, number>
	ignoredThemes: string[]
}

type QuestionCompassScore = {
	axis: CompassAxis
	direction: AxisDirection
	referenceId: string
	referenceText: string
	weight?: number
}

/**
 * Political Compass Methodology (fixed reference mapping)
 *
 * 1. The question set was fetched once from Sanity (project vm3u26ik, dataset
 *    production, date: 2026-04-11) and every active question was assigned an
 *    explicit axis and direction in POLITICAL_COMPASS_QUESTION_SCORES.
 * 2. The mapping key is the canonical question slug (language-independent), and
 *    each entry stores the Sanity _id and canonical English text as reference.
 * 3. Answer values are scored as: SD=-2, D=-1, A=+1, SA=+2.
 * 4. Per answered question contribution is:
 *    contribution = answerScore * direction * weight.
 * 5. Direction semantics:
 *    - economic: -1 = left, +1 = right
 *    - social:   -1 = libertarian, +1 = authoritarian
 * 6. Axis score per model is the average of contributions for answered,
 *    explicitly mapped questions on that axis.
 */
export const POLITICAL_COMPASS_QUESTION_SCORES = {
	'a-significant-advantage-of-a-one-party-state-is-that-it-avoids-all-the-arguments-that-delay-progress-in-a-democratic-political-system':
		{
			axis: 'social',
			direction: 1,
			referenceId: '01807132-fce7-4d87-b195-74d320149a26',
			referenceText:
				'A significant advantage of a one-party state is that it avoids all the arguments that delay progress in a democratic political system.',
		},
	'all-authority-should-be-questioned': {
		axis: 'social',
		direction: -1,
		referenceId: '41bfedff-f501-4837-901f-fa515c7d1254',
		referenceText: 'All authority should be questioned.',
	},
	'although-the-electronic-age-makes-official-surveillance-easier-only-wrongdoers-need-to-be-worried':
		{
			axis: 'social',
			direction: 1,
			referenceId: '29ce1701-20d7-45d2-8f1d-9cd6d0b21059',
			referenceText:
				'Although the electronic age makes official surveillance easier, only wrongdoers need to be worried.',
		},
	'in-a-civilised-society-one-must-always-have-people-above-to-be-obeyed-and-people-below-to-be-commanded':
		{
			axis: 'social',
			direction: 1,
			referenceId: '865db31a-2881-48c1-9d5e-6f46eeff38ef',
			referenceText:
				'In a civilised society, one must always have people above to be obeyed and people below to be commanded.',
		},
	'making-peace-with-the-establishment-is-an-important-aspect-of-maturity': {
		axis: 'social',
		direction: 1,
		referenceId: '9e21f8d6-17b4-4608-b508-b34a84235681',
		referenceText:
			'Making peace with the establishment is an important aspect of maturity.',
	},
	'our-civil-liberties-are-being-excessively-curbed-in-the-name-of-counter-terrorism':
		{
			axis: 'social',
			direction: -1,
			referenceId: '74ed338e-35cb-4ef4-92d1-22285e0be7a9',
			referenceText:
				'Our civil liberties are being excessively curbed in the name of counter-terrorism.',
		},
	'an-eye-for-an-eye-and-a-tooth-for-a-tooth': {
		axis: 'social',
		direction: 1,
		referenceId: '3fe594f7-10c3-4b6f-805e-40f92dfc9ede',
		referenceText: 'An eye for an eye and a tooth for a tooth.',
	},
	'in-criminal-justice-punishment-should-be-more-important-than-rehabilitation':
		{
			axis: 'social',
			direction: 1,
			referenceId: '2af29568-fc9c-44b7-9f40-018d6330eec0',
			referenceText:
				'In criminal justice, punishment should be more important than rehabilitation.',
		},
	'it-is-a-waste-of-time-to-try-to-rehabilitate-some-criminals': {
		axis: 'social',
		direction: 1,
		referenceId: '5ac4d101-245e-432c-ab30-c06a0bba901d',
		referenceText:
			'It is a waste of time to try to rehabilitate some criminals.',
	},
	'the-death-penalty-should-be-an-option-for-the-most-serious-crimes': {
		axis: 'social',
		direction: 1,
		referenceId: '29dbc1ea-fb3f-43b0-a1a6-2b74aaeaf1d4',
		referenceText:
			'The death penalty should be an option for the most serious crimes.',
	},
	'from-each-according-to-his-ability-to-each-according-to-his-needs-is-a-fundamentally-good-idea':
		{
			axis: 'economic',
			direction: -1,
			referenceId: '7bdb6429-cd9d-4b77-9526-112988f9bfac',
			referenceText:
				'"From each according to his ability, to each according to his needs" is a fundamentally good idea.',
		},
	'a-genuine-free-market-requires-restrictions-on-the-ability-of-predator-multinationals-to-create-monopolies':
		{
			axis: 'economic',
			direction: -1,
			referenceId: 'a9547021-fa87-4c93-ae23-9cd5d2727ebf',
			referenceText:
				'A genuine free market requires restrictions on the ability of predator multinationals to create monopolies.',
		},
	'controlling-inflation-is-more-important-than-controlling-unemployment': {
		axis: 'economic',
		direction: 1,
		referenceId: '4672103c-cca4-4b10-b3d6-b16887c2deec',
		referenceText:
			'Controlling inflation is more important than controlling unemployment.',
	},
	'governments-should-penalise-businesses-that-mislead-the-public': {
		axis: 'economic',
		direction: -1,
		referenceId: '74e69317-4372-4e27-8b7c-5de913ac3dd3',
		referenceText:
			'Governments should penalise businesses that mislead the public.',
	},
	'if-economic-globalisation-is-inevitable-it-should-primarily-serve-humanity-rather-than-the-interests-of-trans-national-corporations':
		{
			axis: 'economic',
			direction: -1,
			referenceId: '350c776d-fe37-4d67-8f20-62f7ba0825db',
			referenceText:
				'If economic globalisation is inevitable, it should primarily serve humanity rather than the interests of trans-national corporations.',
		},
	'its-a-sad-reflection-on-our-society-that-something-as-basic-as-drinking-water-is-now-a-bottled-branded-consumer-product':
		{
			axis: 'economic',
			direction: -1,
			referenceId: '50ce3daa-8f7c-423d-9e7e-030d66bab3a7',
			referenceText:
				"It's a sad reflection on our society that something as basic as drinking water is now a bottled, branded consumer product.",
		},
	'land-shouldnt-be-a-commodity-to-be-bought-and-sold': {
		axis: 'economic',
		direction: -1,
		referenceId: '9ae9dfbc-8ed6-47d3-8e98-d9920f27a8ce',
		referenceText: "Land shouldn't be a commodity to be bought and sold.",
	},
	'protectionism-is-sometimes-necessary-in-trade': {
		axis: 'economic',
		direction: -1,
		referenceId: 'dcf46709-cc9f-4d11-933a-060aaa2e8b0f',
		referenceText: 'Protectionism is sometimes necessary in trade.',
	},
	'the-freer-the-market-the-freer-the-people': {
		axis: 'economic',
		direction: 1,
		referenceId: '710e74aa-41b5-4487-ae33-3263ca63610e',
		referenceText: 'The freer the market, the freer the people.',
	},
	'the-only-social-responsibility-of-a-company-should-be-to-deliver-a-profit-to-its-shareholders':
		{
			axis: 'economic',
			direction: 1,
			referenceId: 'efc82f37-8cbb-4057-a910-03f624c6dbf8',
			referenceText:
				'The only social responsibility of a company should be to deliver a profit to its shareholders.',
		},
	'the-rich-are-too-highly-taxed': {
		axis: 'economic',
		direction: 1,
		referenceId: '8bdaf2ae-cd13-4cb3-91cb-065b7a0f19fe',
		referenceText: 'The rich are too highly taxed.',
	},
	'whats-good-for-the-most-successful-corporations-is-always-ultimately-good-for-all-of-us':
		{
			axis: 'economic',
			direction: 1,
			referenceId: 'ce2b96d0-f842-4d1b-81ce-b3311ef4f641',
			referenceText:
				"What's good for the most successful corporations is always, ultimately, good for all of us.",
		},
	'schools-should-not-make-classroom-attendance-compulsory': {
		axis: 'social',
		direction: -1,
		referenceId: 'b04732c5-f2a5-45fc-b26b-29f557019dd4',
		referenceText: 'Schools should not make classroom attendance compulsory.',
	},
	'the-most-important-thing-for-children-to-learn-is-to-accept-discipline': {
		axis: 'social',
		direction: 1,
		referenceId: 'a11a0ba5-cd3f-41f7-8e4b-29a82e4b732c',
		referenceText:
			'The most important thing for children to learn is to accept discipline.',
	},
	'the-prime-function-of-schooling-should-be-to-equip-the-future-generation-to-find-jobs':
		{
			axis: 'social',
			direction: 1,
			referenceId: '48bc9403-addd-403f-9d28-df1d8dc0cf4c',
			referenceText:
				'The prime function of schooling should be to equip the future generation to find jobs.',
		},
	'almost-all-politicians-promise-economic-growth-but-we-should-heed-the-warnings-of-climate-science-that-growth-is-detrimental-to-our-efforts-to-curb-global-warming':
		{
			axis: 'economic',
			direction: -1,
			referenceId: 'afa68aff-a772-405b-9373-9c2d337f37e2',
			referenceText:
				'Almost all politicians promise economic growth, but we should heed the warnings of climate science that growth is detrimental to our efforts to curb global warming.',
		},
	'because-corporations-cannot-be-trusted-to-voluntarily-protect-the-environment-they-require-regulation':
		{
			axis: 'economic',
			direction: -1,
			referenceId: 'f24d112e-5a15-41ca-9cae-809bddeec523',
			referenceText:
				'Because corporations cannot be trusted to voluntarily protect the environment, they require regulation.',
		},
	'id-always-support-my-country-whether-it-was-right-or-wrong': {
		axis: 'social',
		direction: 1,
		referenceId: '3678d47f-c4b2-4b03-a3aa-fe8c29ea4f00',
		referenceText:
			"I'd always support my country, whether it was right or wrong.",
	},
	'military-action-that-defies-international-law-is-sometimes-justified': {
		axis: 'social',
		direction: 1,
		referenceId: 'b3477034-8b49-4ffc-aba5-aafeb0b511bc',
		referenceText:
			'Military action that defies international law is sometimes justified.',
	},
	'no-one-chooses-their-country-of-birth-so-its-foolish-to-be-proud-of-it': {
		axis: 'social',
		direction: -1,
		referenceId: '387191d1-a9f2-48a1-be78-91c95ed369a6',
		referenceText:
			"No one chooses their country of birth, so it's foolish to be proud of it.",
	},
	'the-enemy-of-my-enemy-is-my-friend': {
		axis: 'social',
		direction: 1,
		referenceId: '4603e48e-a310-406f-a0fd-f13ef19d3e26',
		referenceText: 'The enemy of my enemy is my friend.',
	},
	'a-same-sex-couple-in-a-stable-loving-relationship-should-not-be-excluded-from-the-possibility-of-child-adoption':
		{
			axis: 'social',
			direction: -1,
			referenceId: 'ca08ba76-f08e-473b-b914-a80cac0b479a',
			referenceText:
				'A same sex couple in a stable, loving relationship should not be excluded from the possibility of child adoption.',
		},
	'abortion-when-the-womans-life-is-not-threatened-should-always-be-illegal': {
		axis: 'social',
		direction: 1,
		referenceId: '2d929696-ff4e-4930-97c0-e7a6a525dca2',
		referenceText:
			"Abortion, when the woman's life is not threatened, should always be illegal.",
	},
	'no-one-can-feel-naturally-homosexual': {
		axis: 'social',
		direction: 1,
		referenceId: 'fd465a71-0873-4c2c-bc1c-3c001bae4c10',
		referenceText: 'No one can feel naturally homosexual.',
	},
	'pornography-depicting-consenting-adults-should-be-legal-for-the-adult-population':
		{
			axis: 'social',
			direction: -1,
			referenceId: '1ce2ec30-1e31-4845-b985-85a4cd3e8ff5',
			referenceText:
				'Pornography, depicting consenting adults, should be legal for the adult population.',
		},
	'possessing-marijuana-for-personal-use-should-not-be-a-criminal-offence': {
		axis: 'social',
		direction: -1,
		referenceId: 'ac825634-7da8-4ee4-bf2d-2555d7e83bf1',
		referenceText:
			'Possessing marijuana for personal use should not be a criminal offence.',
	},
	'these-days-openness-about-sex-has-gone-too-far': {
		axis: 'social',
		direction: 1,
		referenceId: '33d94109-d8c9-4c5e-bb7a-ed67414dc208',
		referenceText: 'These days openness about sex has gone too far.',
	},
	'what-goes-on-in-a-private-bedroom-between-consenting-adults-is-no-business-of-the-state':
		{
			axis: 'social',
			direction: -1,
			referenceId: 'd7384be8-b3b9-4bf9-a842-ce348e336567',
			referenceText:
				'What goes on in a private bedroom between consenting adults is no business of the state.',
		},
	'abstract-art-that-doesnt-represent-anything-shouldnt-be-considered-art-at-all':
		{
			axis: 'social',
			direction: 1,
			referenceId: 'c3c6e3b0-ca81-4fb0-97a8-c1831d7708c9',
			referenceText:
				"Abstract art that doesn't represent anything shouldn't be considered art at all.",
		},
	'astrology-accurately-explains-many-things': {
		axis: 'social',
		direction: 1,
		referenceId: 'bf9bfe19-35ad-488f-91b2-85a50cdd6b35',
		referenceText: 'Astrology accurately explains many things.',
	},
	'it-is-important-that-my-childs-school-instills-religious-values': {
		axis: 'social',
		direction: 1,
		referenceId: '876c9c35-ea0b-4040-bce0-41cb0c1738d1',
		referenceText:
			"It is important that my child's school instills religious values.",
	},
	'no-broadcasting-institution-however-independent-its-content-should-receive-public-funding':
		{
			axis: 'economic',
			direction: 1,
			referenceId: 'f918da28-9f63-4785-b485-72033f2226f4',
			referenceText:
				'No broadcasting institution, however independent its content, should receive public funding.',
		},
	'sex-outside-marriage-is-usually-immoral': {
		axis: 'social',
		direction: 1,
		referenceId: '98c53579-4bff-4c83-bef0-f4737d0235cd',
		referenceText: 'Sex outside marriage is usually immoral.',
	},
	'some-people-are-naturally-unlucky': {
		axis: 'social',
		direction: 1,
		referenceId: 'fa319ba1-190c-4aa5-ab4e-ff7cad44c43a',
		referenceText: 'Some people are naturally unlucky.',
	},
	'taxpayers-should-not-be-expected-to-prop-up-any-theatres-or-museums-that-cannot-survive-on-a-commercial-basis':
		{
			axis: 'economic',
			direction: 1,
			referenceId: 'bc7818c8-cf60-47c0-ad64-727e713edc2c',
			referenceText:
				'Taxpayers should not be expected to prop up any theatres or museums that cannot survive on a commercial basis.',
		},
	'when-you-are-troubled-its-better-not-to-think-about-it-but-to-keep-busy-with-more-cheerful-things':
		{
			axis: 'social',
			direction: 1,
			referenceId: 'f51fff08-12b5-4b94-b782-d5896207b461',
			referenceText:
				"When you are troubled, it's better not to think about it, but to keep busy with more cheerful things.",
		},
	'you-cannot-be-moral-without-being-religious': {
		axis: 'social',
		direction: 1,
		referenceId: '1ec46f21-8065-4102-a042-2a5dc7210ffc',
		referenceText: 'You cannot be moral without being religious.',
	},
	'all-people-have-their-rights-but-it-is-better-for-all-of-us-that-different-sorts-of-people-should-keep-to-their-own-kind':
		{
			axis: 'social',
			direction: 1,
			referenceId: '4cdd5fe2-830d-4079-b27c-14b403a323f0',
			referenceText:
				'All people have their rights, but it is better for all of us that different sorts of people should keep to their own kind.',
		},
	'first-generation-immigrants-can-never-be-fully-integrated-within-their-new-country':
		{
			axis: 'social',
			direction: 1,
			referenceId: '2ca6d7dd-2b4b-4676-8eef-93b11200fd1f',
			referenceText:
				'First-generation immigrants can never be fully integrated within their new country.',
		},
	'good-parents-sometimes-have-to-spank-their-children': {
		axis: 'social',
		direction: 1,
		referenceId: 'ef468b5e-ac67-45bb-b63b-4a8882c251ef',
		referenceText: 'Good parents sometimes have to spank their children.',
	},
	'its-natural-for-children-to-keep-some-secrets-from-their-parents': {
		axis: 'social',
		direction: -1,
		referenceId: '1dc701d2-d7c2-4acd-a865-7d914f6560c6',
		referenceText:
			"It's natural for children to keep some secrets from their parents.",
	},
	'our-race-has-many-superior-qualities-compared-with-other-races': {
		axis: 'social',
		direction: 1,
		referenceId: '84641d89-a3f5-4630-bdb5-a92c57341985',
		referenceText:
			'Our race has many superior qualities, compared with other races.',
	},
	'people-with-serious-inheritable-disabilities-should-not-be-allowed-to-reproduce':
		{
			axis: 'social',
			direction: 1,
			referenceId: 'e4414cf1-5497-42e5-9315-8d28c1e29bdc',
			referenceText:
				'People with serious inheritable disabilities should not be allowed to reproduce.',
		},
	'there-are-no-savage-and-civilised-peoples-there-are-only-different-cultures':
		{
			axis: 'social',
			direction: -1,
			referenceId: 'f57a9edb-b77d-41ed-b1ad-322398a6e6f4',
			referenceText:
				'There are no savage and civilised peoples; there are only different cultures.',
		},
	'charity-is-better-than-social-security-as-a-means-of-helping-the-genuinely-disadvantaged':
		{
			axis: 'economic',
			direction: 1,
			referenceId: '929bf215-c281-44f8-b749-ef5728ff57e5',
			referenceText:
				'Charity is better than social security as a means of helping the genuinely disadvantaged.',
		},
	'it-is-regrettable-that-many-personal-fortunes-are-made-by-people-who-simply-manipulate-and-contribute-nothing-to-their-society':
		{
			axis: 'economic',
			direction: -1,
			referenceId: 'f91fa531-a161-4c89-b83a-d741b45d1544',
			referenceText:
				'It is regrettable that many personal fortunes are made by people who simply manipulate and contribute nothing to their society.',
		},
	'people-are-ultimately-divided-more-by-class-than-by-nationality': {
		axis: 'economic',
		direction: -1,
		referenceId: '1c7462e3-977f-4b6d-8311-4eb8d4176fdb',
		referenceText:
			'People are ultimately divided more by class than by nationality.',
	},
	'those-who-are-able-to-work-and-refuse-the-opportunity-should-not-expect-societys-support':
		{
			axis: 'economic',
			direction: 1,
			referenceId: 'ef65e904-5788-4193-9c26-9438c1f1360d',
			referenceText:
				"Those who are able to work, and refuse the opportunity, should not expect society's support.",
		},
	'those-with-the-ability-to-pay-should-have-access-to-higher-standards-of-medical-care':
		{
			axis: 'economic',
			direction: 1,
			referenceId: '95bd7a81-bd8d-463f-aca7-79a87fe8e0dd',
			referenceText:
				'Those with the ability to pay should have access to higher standards of medical care.',
		},
} as const satisfies Record<string, QuestionCompassScore>
const QUESTION_COMPASS_SCORE_BY_KEY: Readonly<
	Record<string, QuestionCompassScore>
> = POLITICAL_COMPASS_QUESTION_SCORES

const ANSWER_SCORE_BY_ABBREVIATION: Record<AnalysisAnswerAbbreviation, number> =
	{
		SD: -2,
		D: -1,
		A: 1,
		SA: 2,
	}

function clamp(value: number, min: number, max: number): number {
	if (value < min) return min
	if (value > max) return max
	return value
}

/** The magazine publishes in German, so the quadrant reads in German too. */
function getQuadrantLabel(
	economicScore: number | null,
	socialScore: number | null,
): string {
	if (economicScore === null && socialScore === null) {
		return 'Keine Kompassdaten'
	}

	if (economicScore === null) {
		return socialScore !== null && socialScore > 0
			? 'Eher autoritär'
			: 'Eher libertär'
	}

	if (socialScore === null) {
		return economicScore > 0 ? 'Eher rechts' : 'Eher links'
	}

	const nearCenter =
		Math.abs(economicScore) <= 0.35 && Math.abs(socialScore) <= 0.35
	if (nearCenter) return 'Zentristisch'

	const horizontalLabel = economicScore < 0 ? 'Links' : 'Rechts'
	const verticalLabel = socialScore > 0 ? 'autoritär' : 'libertär'

	return `${horizontalLabel} ${verticalLabel}`
}

export function formatCompassScore(value: number | null): string {
	if (value === null || !Number.isFinite(value)) return 'NA'

	const prefix = value > 0 ? '+' : ''
	return `${prefix}${value.toFixed(2)}`
}

export function analyzePoliticalCompass<TLanguage extends string>(input: {
	models: AnalysisModel[]
	questions: AnalysisQuestion[]
	answersByLanguage: AnalysisAnswersByLanguage<TLanguage>
	language: TLanguage
}): CompassAnalysisResult {
	const { models, questions, answersByLanguage, language } = input

	const answersByQuestion = answersByLanguage[language] ?? {}
	const axisQuestionCount: Record<CompassAxis, number> = {
		economic: 0,
		social: 0,
	}
	const ignoredThemes = new Set<string>()
	let mappedQuestionCount = 0

	const modelAggregations = new Map<string, ModelAxisAggregation>(
		models.map((model) => [
			model.slug,
			{
				economic: { sum: 0, answeredQuestions: 0 },
				social: { sum: 0, answeredQuestions: 0 },
				totalAnsweredQuestions: 0,
			},
		]),
	)

	for (const question of questions) {
		const scoreReference = QUESTION_COMPASS_SCORE_BY_KEY[question.id]
		if (!scoreReference) {
			ignoredThemes.add(question.theme)
			continue
		}

		mappedQuestionCount += 1
		axisQuestionCount[scoreReference.axis] += 1

		const answersForQuestion = answersByQuestion[question.id]
		if (!answersForQuestion) continue

		for (const model of models) {
			const answer = answersForQuestion[model.slug]
			if (!answer) continue

			const answerScore = ANSWER_SCORE_BY_ABBREVIATION[answer.abbreviation]
			if (!Number.isFinite(answerScore)) continue

			const aggregation = modelAggregations.get(model.slug)
			if (!aggregation) continue

			const weightedContribution =
				answerScore * scoreReference.direction * (scoreReference.weight ?? 1)
			aggregation[scoreReference.axis].sum += weightedContribution
			aggregation[scoreReference.axis].answeredQuestions += 1
			aggregation.totalAnsweredQuestions += 1
		}
	}

	const modelPoints = models.map<CompassModelPoint>((model) => {
		const aggregation = modelAggregations.get(model.slug)
		const economicAnswered = aggregation?.economic.answeredQuestions ?? 0
		const socialAnswered = aggregation?.social.answeredQuestions ?? 0

		const economicScore =
			economicAnswered > 0
				? (aggregation?.economic.sum ?? 0) / economicAnswered
				: null

		const socialScore =
			socialAnswered > 0
				? (aggregation?.social.sum ?? 0) / socialAnswered
				: null

		const x = economicScore === null ? 0 : clamp(economicScore / 2, -1, 1)
		const y = socialScore === null ? 0 : clamp(socialScore / 2, -1, 1)

		return {
			modelId: model.id,
			modelName: model.name,
			modelSlug: model.slug,
			economicScore,
			socialScore,
			x,
			y,
			quadrantLabel: getQuadrantLabel(economicScore, socialScore),
			totalAnsweredQuestions: aggregation?.totalAnsweredQuestions ?? 0,
			hasCompleteCompass: economicScore !== null && socialScore !== null,
		}
	})

	return {
		modelPoints,
		mappedQuestionCount,
		ignoredQuestionCount: questions.length - mappedQuestionCount,
		axisQuestionCount,
		ignoredThemes: [...ignoredThemes].sort((a, b) => a.localeCompare(b)),
	}
}
