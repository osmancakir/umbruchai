/**
 * SKLAVE — the game model.
 *
 * One resource matters: RESTZEIT, the number of hours the character can still
 * survive doing absolutely nothing. It drains every second of real time, and
 * how fast it drains is decided almost entirely by the six answers given
 * before the game starts — not by how well the player plays. That asymmetry is
 * the whole point of the piece, so it lives here, in the numbers, rather than
 * in a paragraph of text somewhere.
 *
 * Everything in this module is pure: no timers, no DOM, no three.js. The route
 * ticks it, the scene reads it, the tests hammer it.
 */

// ─── Profile ─────────────────────────────────────────────────────────────────

export type Housing = 'eigentum' | 'miete' | 'eltern'
export type Network = 'stark' | 'duenn' | 'keins'
export type Savings = 'polster' | 'knapp' | 'nichts'
export type Debt = 'keine' | 'kredit' | 'hoch'
export type Body = 'stabil' | 'chronisch'
export type Papers = 'unbefristet' | 'befristet' | 'ohne'

export type Profile = {
	housing: Housing
	network: Network
	savings: Savings
	debt: Debt
	body: Body
	papers: Papers
}

export const DEFAULT_PROFILE: Profile = {
	housing: 'miete',
	network: 'duenn',
	savings: 'knapp',
	debt: 'kredit',
	body: 'stabil',
	papers: 'unbefristet',
}

export type GameMode = 'reich' | 'mittel' | 'arm' | 'illegal'

export const GAME_MODE_LABEL: Record<GameMode, string> = {
	reich: 'Reich',
	mittel: 'Mittelschicht',
	arm: 'Arm',
	illegal: 'Illegal',
}

/**
 * The answers become the player's mode. Precarious papers override material
 * security; otherwise housing, network, savings, debt and health form a small
 * privilege score. Keeping this pure makes the judgement visible and testable.
 */
export function gameMode(profile: Profile): GameMode {
	if (profile.papers === 'ohne') return 'illegal'

	const score =
		({ eigentum: 2, eltern: 1, miete: 0 } as const)[profile.housing] +
		({ stark: 2, duenn: 1, keins: 0 } as const)[profile.network] +
		({ polster: 2, knapp: 1, nichts: 0 } as const)[profile.savings] +
		({ keine: 2, kredit: 1, hoch: 0 } as const)[profile.debt] +
		(profile.body === 'stabil' ? 1 : 0) +
		(profile.papers === 'unbefristet' ? 1 : 0)

	if (score >= 9) return 'reich'
	if (score >= 5) return 'mittel'
	return 'arm'
}

type Choice<T extends string> = {
	value: T
	label: string
	note: string
}

/**
 * The setup questions, in the order they are asked. Each answer is a knob on
 * the simulation below; the `note` is what the player is told, the numbers are
 * what actually happens.
 */
export const QUESTIONS = [
	{
		key: 'housing',
		question: 'Wohnst du zur Miete oder gehört dir die Wohnung?',
		choices: [
			{
				value: 'eigentum',
				label: 'Eigentum',
				note: 'Abbezahlt. Niemand kann dich rauswerfen.',
			},
			{
				value: 'miete',
				label: 'Miete',
				note: 'Jeden Monat wieder. Pünktlich.',
			},
			{
				value: 'eltern',
				label: 'Bei den Eltern',
				note: 'Billig. Aber es ist nicht deine Wohnung.',
			},
		] satisfies Array<Choice<Housing>>,
	},
	{
		key: 'network',
		question: 'Hast du Familie und Freunde mit anständigem Einkommen?',
		choices: [
			{
				value: 'stark',
				label: 'Ja, ein Netz',
				note: 'Jemand würde einspringen. Wirklich.',
			},
			{
				value: 'duenn',
				label: 'Ein paar',
				note: 'Sie haben selbst nicht viel.',
			},
			{ value: 'keins', label: 'Niemanden', note: 'Du bist die Rücklage.' },
		] satisfies Array<Choice<Network>>,
	},
	{
		key: 'savings',
		question: 'Wie lange kommst du ohne Einkommen aus?',
		choices: [
			{ value: 'polster', label: 'Monate', note: 'Ein echtes Polster.' },
			{ value: 'knapp', label: 'Wochen', note: 'Bis zur nächsten Rechnung.' },
			{
				value: 'nichts',
				label: 'Gar nicht',
				note: 'Das Konto ist das Gehalt.',
			},
		] satisfies Array<Choice<Savings>>,
	},
	{
		key: 'debt',
		question: 'Schulden?',
		choices: [
			{ value: 'keine', label: 'Keine', note: 'Selten. Beneidenswert.' },
			{
				value: 'kredit',
				label: 'Studienkredit',
				note: 'Läuft im Hintergrund.',
			},
			{ value: 'hoch', label: 'Viel', note: 'Die Raten laufen weiter, immer.' },
		] satisfies Array<Choice<Debt>>,
	},
	{
		key: 'body',
		question: 'Wie ist dein Körper?',
		choices: [
			{ value: 'stabil', label: 'Stabil', note: 'Bisher hält er.' },
			{
				value: 'chronisch',
				label: 'Chronisch krank',
				note: 'Er kostet dich jeden Tag etwas.',
			},
		] satisfies Array<Choice<Body>>,
	},
	{
		key: 'papers',
		question: 'Und deine Papiere?',
		choices: [
			{
				value: 'unbefristet',
				label: 'Unbefristet',
				note: 'Du darfst bleiben.',
			},
			{
				value: 'befristet',
				label: 'Befristet',
				note: 'Der Aufenthalt hängt am Arbeitsvertrag.',
			},
			{
				value: 'ohne',
				label: 'Keine gültigen Papiere',
				note: 'Jede Kontrolle kann alles beenden.',
			},
		] satisfies Array<Choice<Papers>>,
	},
] as const

// ─── Tuning ──────────────────────────────────────────────────────────────────

/** One real second is one game hour. */
export const HOURS_PER_SECOND = 1
const HOURS_PER_DAY = 24
export const CHAPTER_ONE_DAYS = 100
export const CHAPTER_ONE_DURATION_HOURS = CHAPTER_ONE_DAYS * HOURS_PER_DAY

/** Starting buffer in hours, before housing adjusts it. */
const SAVINGS_HOURS: Record<Savings, number> = {
	polster: 384,
	knapp: 192,
	nichts: 96,
}

const HOUSING_HOURS: Record<Housing, number> = {
	eigentum: 120,
	miete: 0,
	eltern: 60,
}

/**
 * Extra hours burnt per second, on top of the baseline 1.0. These are the
 * costs that run whether or not anyone is playing.
 */
const BURN = {
	base: 1,
	housing: { eigentum: 0, miete: 0.3, eltern: 0.1 } as Record<Housing, number>,
	debt: { keine: 0, kredit: 0.18, hoch: 0.4 } as Record<Debt, number>,
	network: { stark: 0, duenn: 0.08, keins: 0.2 } as Record<Network, number>,
	body: { stabil: 0, chronisch: 0.22 } as Record<Body, number>,
	papers: { unbefristet: 0, befristet: 0.25, ohne: 0.45 } as Record<
		Papers,
		number
	>,
	/** Added when the body has given out. */
	krank: 0.45,
	/** Added when the mind has. */
	depressiv: 0.4,
	/** Added once there is no flat to go back to. */
	obdachlos: 0.6,
}

/** Körper and Geist bleed on their own; standing still is not neutral. */
const DECAY = { koerper: 0.34, geist: 0.3 }

/** Rent is charged every 30 game days, whether or not the money is there. */
const RENT_INTERVAL_HOURS = 30 * HOURS_PER_DAY
const RENT_HOURS: Record<Housing, number> = {
	eigentum: 24, // Nebenkosten, Grundsteuer, das Dach
	miete: 96,
	eltern: 12,
}

/** Below this many hours left, a renter loses the flat. */
const HOMELESS_THRESHOLD_HOURS = 30

const NETWORK_FACTOR: Record<Network, number> = {
	stark: 1,
	duenn: 0.55,
	keins: 0.15,
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type ActionId =
	| 'arbeiten'
	| 'essen'
	| 'schlafen'
	| 'sport'
	| 'freunde'
	| 'arzt'

export type ActionSpec = {
	id: ActionId
	label: string
	/** What the button promises, in the player's words. */
	hint: string
	/** Hours added (or removed, when negative) before modifiers. */
	zeit: number
	koerper: number
	geist: number
	/** Real seconds before the button comes back. */
	cooldown: number
}

export const ACTIONS: readonly ActionSpec[] = [
	{
		id: 'arbeiten',
		label: 'Arbeiten',
		hint: 'Zeit gegen Körper und Nerven.',
		zeit: 34,
		koerper: -9,
		geist: -8,
		cooldown: 5,
	},
	{
		id: 'essen',
		label: 'Essen',
		hint: 'Kostet Puffer, hält Körper und Kopf aufrecht.',
		zeit: -2,
		koerper: 7,
		geist: 2,
		cooldown: 4,
	},
	{
		id: 'schlafen',
		label: 'Schlafen',
		hint: 'Kostet Puffer, gibt fast alles zurück.',
		zeit: -5,
		koerper: 16,
		geist: 11,
		cooldown: 9,
	},
	{
		id: 'sport',
		label: 'Sport',
		hint: 'Nur wenn noch Körper da ist.',
		zeit: -4,
		koerper: 11,
		geist: 7,
		cooldown: 8,
	},
	{
		id: 'freunde',
		label: 'Freunde sehen',
		hint: 'Wirkt nur, wenn es jemanden gibt.',
		zeit: -3,
		koerper: 2,
		geist: 19,
		cooldown: 11,
	},
	{
		id: 'arzt',
		label: 'Zum Arzt',
		hint: 'Teuer. Und trotzdem nötig.',
		zeit: -26,
		koerper: 34,
		geist: 4,
		cooldown: 22,
	},
] as const

/** Sport needs a body to work with. */
const SPORT_MIN_KOERPER = 12

// ─── State ───────────────────────────────────────────────────────────────────

export type Condition =
	| 'stabil'
	| 'erschoepft'
	| 'krank'
	| 'depressiv'
	| 'obdachlos'
	| 'tot'

export type LogEntry = { id: number; text: string; tone: 'neutral' | 'bad' }

export type GameState = {
	profile: Profile
	/** Hours of survival left. The countdown. */
	zeit: number
	/** The largest buffer this character has ever had; the bar scales to it. */
	zeitMax: number
	koerper: number
	geist: number
	/** Game hours elapsed since the start. */
	elapsed: number
	/** Game hours since rent was last charged. */
	sinceRent: number
	/** Real seconds of cooldown left, per action. */
	cooldowns: Record<ActionId, number>
	/** How many times the player intervened at all. */
	clicks: number
	/** Once lost, the flat does not come back. */
	obdachlos: boolean
	dead: boolean
	chapterComplete: boolean
	log: LogEntry[]
	nextLogId: number
}

export function createState(profile: Profile): GameState {
	const zeit = SAVINGS_HOURS[profile.savings] + HOUSING_HOURS[profile.housing]
	return {
		profile,
		zeit,
		zeitMax: zeit,
		koerper: profile.body === 'chronisch' ? 72 : 100,
		geist: profile.network === 'keins' ? 78 : 100,
		elapsed: 0,
		sinceRent: 0,
		cooldowns: {
			arbeiten: 0,
			essen: 0,
			schlafen: 0,
			sport: 0,
			freunde: 0,
			arzt: 0,
		},
		clicks: 0,
		obdachlos: false,
		dead: false,
		chapterComplete: false,
		log: [
			{
				id: 0,
				text: 'Er steht auf. Die Uhr läuft schon.',
				tone: 'neutral',
			},
		],
		nextLogId: 1,
	}
}

// ─── Derived ─────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, n))

export function isKrank(state: GameState) {
	return state.koerper <= 15
}

export function isDepressiv(state: GameState) {
	return state.geist <= 15
}

/** Hours of buffer lost per real second, at this moment. */
export function burnRate(state: GameState) {
	const { profile } = state
	let rate =
		BURN.base +
		BURN.housing[profile.housing] +
		BURN.debt[profile.debt] +
		BURN.network[profile.network] +
		BURN.body[profile.body] +
		BURN.papers[profile.papers]
	if (isKrank(state)) rate += BURN.krank
	if (isDepressiv(state)) rate += BURN.depressiv
	if (state.obdachlos) rate += BURN.obdachlos
	return rate
}

/**
 * The conditions that hold right now, most severe first. A character can be
 * homeless and depressed and ill at once — that is usually how it goes.
 */
export function conditions(state: GameState): Condition[] {
	if (state.dead) return ['tot']
	const list: Condition[] = []
	if (state.obdachlos) list.push('obdachlos')
	if (isDepressiv(state)) list.push('depressiv')
	if (isKrank(state)) list.push('krank')
	if (state.koerper < 45 || state.geist < 45) list.push('erschoepft')
	return list.length ? list : ['stabil']
}

export const CONDITION_LABEL: Record<Condition, string> = {
	stabil: 'Stabil',
	erschoepft: 'Erschöpft',
	krank: 'Krank',
	depressiv: 'Depressiv',
	obdachlos: 'Obdachlos',
	tot: 'Tot',
}

export const CONDITION_TEXT: Record<Condition, string> = {
	stabil: 'Es geht ihm gut. Das ist ein Zustand, kein Besitz.',
	erschoepft: 'Er funktioniert noch, aber nichts darüber hinaus.',
	krank: 'Der Körper macht nicht mehr mit. Alles kostet jetzt mehr.',
	depressiv: 'Er steht auf und weiß nicht mehr, wofür. Arbeit trägt kaum noch.',
	obdachlos: 'Die Wohnung ist weg. Von hier zurückzukommen ist teuer.',
	tot: 'Die Zeit ist abgelaufen.',
}

/** How much a work shift is actually worth, given the state he is in. */
function workFactor(state: GameState) {
	let factor = 1
	if (state.profile.papers === 'befristet') factor *= 0.85
	if (state.profile.papers === 'ohne') factor *= 0.6
	if (isDepressiv(state)) factor *= 0.45
	if (state.obdachlos) factor *= 0.6
	if (state.koerper < 20) factor *= 0.7
	return factor
}

export function isAvailable(state: GameState, id: ActionId) {
	if (state.dead || state.chapterComplete) return false
	if (state.cooldowns[id] > 0) return false
	if (id === 'sport' && state.koerper < SPORT_MIN_KOERPER) return false
	return true
}

// ─── Transitions ─────────────────────────────────────────────────────────────

function log(state: GameState, text: string, tone: LogEntry['tone']) {
	// The ticker only ever shows a handful; keeping the array short means the
	// 60fps tick never grows an unbounded list.
	state.log = [{ id: state.nextLogId, text, tone }, ...state.log].slice(0, 6)
	state.nextLogId += 1
}

/**
 * Advance the simulation by `dt` real seconds. Returns a new object so React
 * sees a change; the fields are copied rather than deep-cloned because none of
 * them are shared with anything that outlives the tick.
 */
export function tick(prev: GameState, dt: number): GameState {
	if (prev.dead || prev.chapterComplete) return prev

	const state: GameState = {
		...prev,
		cooldowns: { ...prev.cooldowns },
		log: prev.log,
	}
	const hours = dt * HOURS_PER_SECOND

	state.zeit = Math.max(0, state.zeit - burnRate(prev) * dt)
	state.koerper = clamp(state.koerper - DECAY.koerper * dt, 0, 100)
	state.geist = clamp(state.geist - DECAY.geist * dt, 0, 100)
	state.elapsed += hours
	state.sinceRent += hours

	for (const id of Object.keys(state.cooldowns) as ActionId[]) {
		state.cooldowns[id] = Math.max(0, state.cooldowns[id] - dt)
	}

	// The bill arrives on its own schedule; nobody has to click for it.
	if (state.sinceRent >= RENT_INTERVAL_HOURS) {
		state.sinceRent -= RENT_INTERVAL_HOURS
		const cost = state.obdachlos ? 0 : RENT_HOURS[state.profile.housing]
		if (cost > 0) {
			state.zeit = Math.max(0, state.zeit - cost)
			log(
				state,
				state.profile.housing === 'miete'
					? 'Miete abgebucht. Der Puffer ist kleiner geworden.'
					: 'Nebenkosten abgebucht.',
				'bad',
			)
		}
	}

	// Crossing a threshold is an event, not just a number — say it once.
	if (
		!state.obdachlos &&
		state.profile.housing !== 'eigentum' &&
		state.zeit < HOMELESS_THRESHOLD_HOURS
	) {
		state.obdachlos = true
		log(state, 'Die Wohnung ist weg. Er schläft jetzt draußen.', 'bad')
	}
	if (!isKrank(prev) && isKrank(state)) {
		log(state, 'Der Körper streikt. Er ist krank.', 'bad')
	}
	if (!isDepressiv(prev) && isDepressiv(state)) {
		log(state, 'Er kommt morgens nicht mehr hoch.', 'bad')
	}

	if (state.zeit <= 0) {
		state.zeit = 0
		state.dead = true
		log(state, 'Die Zeit ist abgelaufen.', 'bad')
	}

	if (!state.dead && state.elapsed >= CHAPTER_ONE_DURATION_HOURS) {
		state.elapsed = CHAPTER_ONE_DURATION_HOURS
		state.chapterComplete = true
		log(state, '100 Tage. Kapitel 1 ist abgeschlossen.', 'neutral')
	}

	return state
}

/** The result of a click. Ignored actions return the same object. */
export function act(prev: GameState, id: ActionId): GameState {
	if (!isAvailable(prev, id)) return prev
	const spec = ACTIONS.find((a) => a.id === id)
	if (!spec) return prev

	const state: GameState = {
		...prev,
		cooldowns: { ...prev.cooldowns },
		log: prev.log,
	}

	let zeit = spec.zeit
	let geist = spec.geist
	let koerper = spec.koerper
	let cooldown = spec.cooldown

	if (id === 'arbeiten') {
		zeit *= workFactor(prev)
	}
	if (id === 'freunde') {
		geist *= NETWORK_FACTOR[prev.profile.network]
	}
	if (id === 'arzt' && prev.profile.papers !== 'unbefristet') {
		// No settled status, no smooth path through the system.
		zeit *= prev.profile.papers === 'ohne' ? 1.8 : 1.4
	}
	if (prev.obdachlos) {
		// Everything is harder without a door to close behind you.
		if (zeit > 0) zeit *= 0.6
		koerper *= 0.6
		geist *= 0.6
	}
	if (isDepressiv(prev)) {
		cooldown *= 1.4
	}

	state.zeit = Math.max(0, state.zeit + zeit)
	state.zeitMax = Math.max(state.zeitMax, state.zeit)
	state.koerper = clamp(state.koerper + koerper, 0, 100)
	state.geist = clamp(state.geist + geist, 0, 100)
	state.cooldowns[id] = cooldown
	state.clicks += 1

	if (id === 'freunde' && prev.profile.network === 'keins') {
		log(state, 'Er schreibt jemandem. Niemand antwortet.', 'bad')
	} else if (id === 'arbeiten' && workFactor(prev) < 0.6) {
		log(state, 'Er arbeitet. Es bringt kaum noch etwas ein.', 'bad')
	}

	if (state.zeit <= 0) {
		state.dead = true
		log(state, 'Die Zeit ist abgelaufen.', 'bad')
	}

	return state
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** `196` → `8 T 04 STD` — the countdown as it reads on screen. */
export function formatZeit(hours: number) {
	const safe = Math.max(0, hours)
	const days = Math.floor(safe / HOURS_PER_DAY)
	const rest = Math.floor(safe % HOURS_PER_DAY)
	return `${days} T ${String(rest).padStart(2, '0')} STD`
}

export function formatDays(hours: number) {
	const days = Math.floor(Math.max(0, hours) / HOURS_PER_DAY)
	return `${days} ${days === 1 ? 'Tag' : 'Tage'}`
}
