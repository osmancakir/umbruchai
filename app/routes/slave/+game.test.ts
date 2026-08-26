import { expect, test } from 'vitest'
import {
	ACTIONS,
	act,
	burnRate,
	CHAPTER_ONE_DURATION_HOURS,
	conditions,
	createState,
	DEFAULT_PROFILE,
	formatZeit,
	gameMode,
	isAvailable,
	tick,
	type Profile,
} from './+game.ts'

const profileWith = (overrides: Partial<Profile>): Profile => ({
	...DEFAULT_PROFILE,
	...overrides,
})

/** Run the simulation for `seconds` in 100ms steps, as the loop would. */
function run(state: ReturnType<typeof createState>, seconds: number) {
	let current = state
	for (let i = 0; i < seconds * 10; i++) current = tick(current, 0.1)
	return current
}

test('savings and housing decide the starting buffer', () => {
	const rich = createState(
		profileWith({ savings: 'polster', housing: 'eigentum' }),
	)
	const poor = createState(profileWith({ savings: 'nichts', housing: 'miete' }))
	expect(rich.zeit).toBeGreaterThan(poor.zeit * 4)
})

test('the same actions cost more when the profile is worse', () => {
	const cushioned = createState(
		profileWith({
			housing: 'eigentum',
			debt: 'keine',
			network: 'stark',
			papers: 'unbefristet',
		}),
	)
	const exposed = createState(
		profileWith({
			housing: 'miete',
			debt: 'hoch',
			network: 'keins',
			papers: 'befristet',
		}),
	)
	expect(burnRate(cushioned)).toBe(1)
	expect(burnRate(exposed)).toBeCloseTo(1 + 0.3 + 0.4 + 0.2 + 0.25, 5)
})

test('the setup answers determine all four game modes', () => {
	expect(
		gameMode(
			profileWith({
				housing: 'eigentum',
				network: 'stark',
				savings: 'polster',
				debt: 'keine',
				body: 'stabil',
				papers: 'unbefristet',
			}),
		),
	).toBe('reich')
	expect(gameMode(DEFAULT_PROFILE)).toBe('mittel')
	expect(
		gameMode(
			profileWith({
				housing: 'miete',
				network: 'keins',
				savings: 'nichts',
				debt: 'hoch',
				body: 'chronisch',
			}),
		),
	).toBe('arm')
	expect(gameMode(profileWith({ papers: 'ohne' }))).toBe('illegal')
})

test('a chronic illness burns time even while nothing happens', () => {
	const stable = createState(profileWith({ body: 'stabil' }))
	const chronic = createState(profileWith({ body: 'chronisch' }))
	expect(burnRate(chronic)).toBeGreaterThan(burnRate(stable))
	expect(chronic.koerper).toBeLessThan(stable.koerper)
})

test('doing nothing drains time and both meters', () => {
	const start = createState(DEFAULT_PROFILE)
	const later = run(start, 10)
	expect(later.zeit).toBeLessThan(start.zeit)
	expect(later.koerper).toBeLessThan(start.koerper)
	expect(later.geist).toBeLessThan(start.geist)
})

test('working buys time and spends body and mind', () => {
	const start = createState(DEFAULT_PROFILE)
	const after = act(start, 'arbeiten')
	expect(after.zeit).toBeGreaterThan(start.zeit)
	expect(after.koerper).toBeLessThan(start.koerper)
	expect(after.geist).toBeLessThan(start.geist)
	expect(after.clicks).toBe(1)
})

test('eating restores body and mind but cannot create infinite time', () => {
	const start = {
		...createState(
			profileWith({
				housing: 'eigentum',
				network: 'stark',
				debt: 'keine',
				body: 'stabil',
				papers: 'unbefristet',
			}),
		),
		koerper: 50,
		geist: 50,
	}
	const afterMeal = act(start, 'essen')

	expect(afterMeal.zeit).toBeLessThan(start.zeit)
	expect(afterMeal.koerper).toBeGreaterThan(start.koerper)
	expect(afterMeal.geist).toBeGreaterThan(start.geist)

	let repeated = start
	const cooldown = ACTIONS.find((action) => action.id === 'essen')!.cooldown
	for (let meal = 0; meal < 10; meal += 1) {
		repeated = act(repeated, 'essen')
		repeated = run(repeated, cooldown)
	}
	expect(repeated.zeit).toBeLessThan(start.zeit)
})

test('an action is unavailable until its cooldown has run out', () => {
	const spec = ACTIONS.find((a) => a.id === 'arbeiten')!
	const after = act(createState(DEFAULT_PROFILE), 'arbeiten')
	expect(isAvailable(after, 'arbeiten')).toBe(false)
	expect(act(after, 'arbeiten')).toBe(after)
	expect(isAvailable(run(after, spec.cooldown + 0.5), 'arbeiten')).toBe(true)
})

test('friends only help if there are any', () => {
	// Both start well below the cap, or the clamp hides the difference.
	const connected = {
		...createState(profileWith({ network: 'stark' })),
		geist: 50,
	}
	const alone = { ...createState(profileWith({ network: 'keins' })), geist: 50 }
	const connectedGain = act(connected, 'freunde').geist - connected.geist
	const aloneGain = act(alone, 'freunde').geist - alone.geist
	expect(connectedGain).toBeGreaterThan(aloneGain * 4)
})

test('a renter loses the flat near zero, an owner never does', () => {
	const renter = { ...createState(profileWith({ housing: 'miete' })), zeit: 25 }
	const owner = {
		...createState(profileWith({ housing: 'eigentum' })),
		zeit: 25,
	}
	expect(tick(renter, 0.1).obdachlos).toBe(true)
	expect(tick(owner, 0.1).obdachlos).toBe(false)
})

test('homelessness makes every intervention worth less', () => {
	const housed = createState(DEFAULT_PROFILE)
	const homeless = { ...housed, obdachlos: true }
	const housedGain = act(housed, 'arbeiten').zeit - housed.zeit
	const homelessGain = act(homeless, 'arbeiten').zeit - homeless.zeit
	expect(homelessGain).toBeLessThan(housedGain)
})

test('an empty mind makes work nearly pointless', () => {
	const ok = createState(DEFAULT_PROFILE)
	const depressed = { ...ok, geist: 5 }
	expect(conditions(depressed)).toContain('depressiv')
	expect(act(depressed, 'arbeiten').zeit - depressed.zeit).toBeLessThan(
		(act(ok, 'arbeiten').zeit - ok.zeit) * 0.6,
	)
})

test('rent is charged after thirty days, whether or not it is there', () => {
	const renter = createState(profileWith({ housing: 'miete' }))
	// Jump to just before the bill so the test does not simulate 720 seconds.
	const eve = { ...renter, sinceRent: 30 * 24 - 0.5, zeit: 500, zeitMax: 500 }
	const after = tick(eve, 1)
	expect(after.zeit).toBeLessThan(eve.zeit - 90)
	expect(after.log[0]?.text).toMatch(/Miete/)
})

test('the run ends when the buffer hits zero', () => {
	const dying = { ...createState(DEFAULT_PROFILE), zeit: 1 }
	const dead = run(dying, 3)
	expect(dead.dead).toBe(true)
	expect(dead.zeit).toBe(0)
	expect(conditions(dead)).toEqual(['tot'])
	// A dead character does not keep ticking.
	expect(tick(dead, 1)).toBe(dead)
	expect(act(dead, 'arbeiten')).toBe(dead)
})

test('chapter one ends after surviving 100 days and locks all actions', () => {
	const almostComplete = {
		...createState(DEFAULT_PROFILE),
		zeit: 1_000,
		zeitMax: 1_000,
		elapsed: CHAPTER_ONE_DURATION_HOURS - 0.5,
	}
	const complete = tick(almostComplete, 1)

	expect(complete.dead).toBe(false)
	expect(complete.chapterComplete).toBe(true)
	expect(complete.elapsed).toBe(CHAPTER_ONE_DURATION_HOURS)
	expect(complete.log[0]?.text).toMatch(/100 Tage/)
	expect(isAvailable(complete, 'arbeiten')).toBe(false)
	expect(tick(complete, 1)).toBe(complete)
	expect(act(complete, 'arbeiten')).toBe(complete)
})

test('running out of time at the chapter boundary is still a death', () => {
	const finalMoment = {
		...createState(DEFAULT_PROFILE),
		zeit: 0.1,
		elapsed: CHAPTER_ONE_DURATION_HOURS - 0.5,
	}
	const dead = tick(finalMoment, 1)

	expect(dead.dead).toBe(true)
	expect(dead.chapterComplete).toBe(false)
})

test('the countdown reads as days and hours', () => {
	expect(formatZeit(196)).toBe('8 T 04 STD')
	expect(formatZeit(0)).toBe('0 T 00 STD')
	expect(formatZeit(-5)).toBe('0 T 00 STD')
})
