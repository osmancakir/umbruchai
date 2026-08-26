/**
 * SKLAVE — the scene.
 *
 * A life, drawn as a floor plan. He stands in the middle of it; the six things
 * he is allowed to do sit at the edges — the desk, the kitchen and the bed, the
 * bike, the picnic by the river, the doctor's room. Clicking sends him there on
 * foot. He always walks back to the middle, and the middle is where nothing
 * happens and the clock still runs.
 *
 * Deliberately flat: an orthographic camera, unlit `MeshBasicMaterial`, black
 * silhouettes on paper. No lights, no shadows, no textures. Depth is only the
 * draw order — things lower in the frame are nearer, so they are drawn in
 * front.
 *
 * three.js is imported dynamically so it never enters the Worker bundle and
 * only downloads once the player actually starts a run.
 */

// Types only — every specifier here is erased at build time, so three itself
// never reaches the Worker bundle. The runtime import lives inside
// `createScene`, which only ever runs in the browser.
import {
	type BufferGeometry,
	type Group,
	type Material,
	type Mesh,
	type Object3D,
} from 'three'

/** Everything the scene is allowed to know about the game. */
export type SceneView = {
	/** Remaining buffer, 0…1 of the largest it has ever been. */
	zeitRatio: number
	koerper: number
	geist: number
	obdachlos: boolean
	krank: boolean
	depressiv: boolean
	dead: boolean
	/** Set for a single frame when the player clicks; sends him walking. */
	pulse: GlyphName | null
}

export type GlyphName =
	| 'arbeiten'
	| 'essen'
	| 'schlafen'
	| 'sport'
	| 'freunde'
	| 'arzt'

export type SceneHandle = {
	render(view: SceneView, dt: number): void
	resize(width: number, height: number): void
	setDark(dark: boolean): void
	dispose(): void
}

// Height is fixed; width adapts. The stations are placed at fractions of
// `spread` (the usable half-width), so a short wide canvas pushes them apart to
// fill the frame instead of leaving the whole plan marooned in the middle.
const WORLD_HEIGHT = 9
/** The narrowest the plan may get before rooms would start colliding. */
const MIN_SPREAD = 7.5
/** The widest it is worth spreading; past this the floor just looks empty. */
const MAX_SPREAD = 13

const PALETTE = {
	light: {
		paper: 0xf5f5f1,
		ink: 0x16181a,
		signal: 0xff4400,
		steel: 0x6b7280,
		steelLt: 0xd6d8d3,
	},
	dark: {
		paper: 0x101214,
		ink: 0xe8e9e4,
		signal: 0xff4400,
		steel: 0x9ba0a5,
		steelLt: 0x2a2d30,
	},
}

type Vec = { x: number; y: number }

/**
 * Where each action happens, and how long he stays. `fx` is a fraction of the
 * spread, resolved into `x` on every resize; `hold` is only the animation — the
 * game model already applied the effect the moment you clicked.
 */
type Station = {
	/** Fraction of the spread — the same one its prop is placed at. */
	fx: number
	/** A fixed offset in world units, so he stays glued to the prop when the
	 *  plan is re-spaced. */
	dx: number
	/** Resolved on every resize. */
	x: number
	/** The height his root sits at: floor level, seat height, or mattress. */
	y: number
	/** Which way he turns once he gets there. */
	face: 1 | -1
	hold: number
}
const STATION_LAYOUT: Record<GlyphName, Omit<Station, 'x'>> = {
	// On the chair (fx of the chair), hips at seat height, facing the screen.
	arbeiten: { fx: -0.617, dx: 0, y: 1.61, face: 1, hold: 3.4 },
	// Standing at the left edge of the kitchen table.
	essen: { fx: 0.511, dx: -1.05, y: 1.5, face: 1, hold: 2.4 },
	// Lying along the mattress, head towards the pillow at the far end.
	schlafen: { fx: 0.778, dx: 0.75, y: 2.0, face: 1, hold: 3.6 },
	// On the saddle.
	sport: { fx: -0.622, dx: -0.05, y: -3.15, face: 1, hold: 3.2 },
	// On the blanket, at the same height as the friends already sitting there.
	freunde: { fx: 0.083, dx: -1.05, y: -3.39, face: 1, hold: 3.4 },
	// In the surgery, opposite the doctor.
	arzt: { fx: 0.689, dx: -0.95, y: -3.5, face: 1, hold: 2.8 },
}

const WALK_SPEED = 5.2

export async function createScene(
	canvas: HTMLCanvasElement,
	options: { dark: boolean; reducedMotion: boolean },
): Promise<SceneHandle> {
	const THREE = await import('three')

	// ─── Bookkeeping so dispose() can be exhaustive ───────────────────────────
	const geometries: BufferGeometry[] = []
	const materials: Material[] = []
	const track = <T extends BufferGeometry>(geometry: T) => {
		geometries.push(geometry)
		return geometry
	}

	// A copy, not the constant itself — `setDark` writes into this.
	const colors = { ...(options.dark ? PALETTE.dark : PALETTE.light) }
	const makeMaterial = (color: number, opacity = 1) => {
		const material = new THREE.MeshBasicMaterial({
			color,
			transparent: opacity < 1,
			opacity,
		})
		materials.push(material)
		return material
	}

	const mat = {
		ink: makeMaterial(colors.ink),
		steel: makeMaterial(colors.steel),
		steelLt: makeMaterial(colors.steelLt),
		signal: makeMaterial(colors.signal),
		rain: makeMaterial(colors.steel, 0.4),
		/** The flat's own material, so it can grey out when he loses it. */
		flat: makeMaterial(colors.steel),
		clock: makeMaterial(colors.ink),
	}

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
	renderer.setClearColor(colors.paper, 1)

	const scene = new THREE.Scene()
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
	camera.position.set(0, 0, 10)

	// ─── Geometry helpers ─────────────────────────────────────────────────────

	/** A centred rounded rectangle in the xy plane, facing the camera. */
	function roundedRect(width: number, height: number, radius: number) {
		const r = Math.min(radius, width / 2, height / 2)
		const x = -width / 2
		const y = -height / 2
		const shape = new THREE.Shape()
		shape.moveTo(x + r, y)
		shape.lineTo(x + width - r, y)
		shape.quadraticCurveTo(x + width, y, x + width, y + r)
		shape.lineTo(x + width, y + height - r)
		shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
		shape.lineTo(x + r, y + height)
		shape.quadraticCurveTo(x, y + height, x, y + height - r)
		shape.lineTo(x, y + r)
		shape.quadraticCurveTo(x, y, x + r, y)
		return track(new THREE.ShapeGeometry(shape, 8))
	}

	const rect = (width: number, height: number) =>
		track(new THREE.PlaneGeometry(width, height))

	/** One bar of a shape, placed and optionally tilted. */
	function bar(
		width: number,
		height: number,
		x: number,
		y: number,
		material: Material,
		rotation = 0,
	) {
		const mesh = new THREE.Mesh(rect(width, height), material)
		mesh.position.set(x, y, 0)
		mesh.rotation.z = rotation
		return mesh
	}

	/** The four walls of a room, drawn as an outline. */
	function room(width: number, height: number, material: Material) {
		const group = new THREE.Group()
		const t = 0.05
		group.add(
			bar(width, t, 0, height / 2, material),
			bar(width, t, 0, -height / 2, material),
			bar(t, height, -width / 2, 0, material),
			bar(t, height, width / 2, 0, material),
		)
		return group
	}

	/**
	 * Draw order is the only depth there is: lower in the frame means nearer,
	 * so it goes in front. Props sit just behind whoever is standing at them.
	 */
	const depth = (y: number, layer = 0) => -y * 0.05 + layer

	// Everything placed by fraction, so `applyLayout` can re-space the whole
	// plan when the canvas aspect changes.
	const placed: Array<{ object: Object3D; fx: number }> = []
	function place(object: Object3D, fx: number, y: number, layer = 0) {
		object.position.set(0, y, depth(y, layer))
		placed.push({ object, fx })
		return object
	}

	const stations = Object.fromEntries(
		Object.entries(STATION_LAYOUT).map(([id, spec]) => [id, { ...spec, x: 0 }]),
	) as Record<GlyphName, Station>

	/** Where he stands when nobody is asking anything of him. */
	const home: Vec = { x: 0, y: 0.3 }
	/** Once the flat is gone, the middle of his life is a box by the river. */
	const roughHome: Vec = { x: 0, y: -2.5 }
	const ROUGH_HOME_FX = -0.267

	let spread = 9

	function applyLayout(nextSpread: number) {
		spread = nextSpread
		for (const { object, fx } of placed) object.position.x = fx * spread
		for (const id of Object.keys(stations) as GlyphName[]) {
			stations[id].x = stations[id].fx * spread + stations[id].dx
		}
		roughHome.x = ROUGH_HOME_FX * spread
		box.position.x = roughHome.x - 0.05
		river.scale.x = spread / 9
	}

	// ─── The cast ─────────────────────────────────────────────────────────────

	const LEG = { width: 0.1, length: 0.44, hip: 0.44 }
	const legGeometry = roundedRect(LEG.width, LEG.length, LEG.width / 2)
	// Move the pivot to the top edge so rotating the mesh swings from the hip.
	legGeometry.translate(0, -LEG.length / 2, 0)
	const torsoGeometry = roundedRect(0.36, 0.64, 0.17)
	const headGeometry = track(new THREE.CircleGeometry(0.16, 24))

	type Figure = {
		root: Group
		legL: Mesh
		legR: Mesh
		torso: Mesh
		head: Mesh
	}

	/** Everyone in this world is this shape. That is the joke, and the point. */
	function makeFigure(material: Material): Figure {
		const root = new THREE.Group()
		const legL = new THREE.Mesh(legGeometry, material)
		const legR = new THREE.Mesh(legGeometry, material)
		legL.position.set(-0.07, LEG.hip, 0)
		legR.position.set(0.07, LEG.hip, -0.001)
		const torso = new THREE.Mesh(torsoGeometry, material)
		torso.position.set(0, 0.68, 0)
		const head = new THREE.Mesh(headGeometry, material)
		head.position.set(0, 1.16, 0)
		root.add(legL, legR, torso, head)
		return { root, legL, legR, torso, head }
	}

	/** Reset a figure to a plain standing pose before each frame's posing. */
	function stand(figure: Figure) {
		figure.legL.rotation.z = 0
		figure.legR.rotation.z = 0
		figure.legL.position.set(-0.07, LEG.hip, 0)
		figure.legR.position.set(0.07, LEG.hip, -0.001)
		figure.torso.rotation.z = 0
		figure.torso.position.set(0, 0.68, 0)
		figure.head.position.set(0, 1.16, 0)
		figure.root.rotation.z = 0
	}

	/** Knees up, the way these silhouettes sit on anything. */
	function sit(figure: Figure, lean = 0) {
		figure.legL.rotation.z = 1.45
		figure.legR.rotation.z = 1.25
		figure.torso.rotation.z = lean
		figure.head.position.set(lean * -0.3, 1.16, 0)
	}

	// ─── The flat: desk, kitchen, bed ─────────────────────────────────────────
	// Grouped together because these are the three things he loses at once when
	// the rent stops being paid.

	const flat = new THREE.Group()

	// Top left: the desk he works at.
	const workRoom = room(5.0, 3.2, mat.steelLt)
	place(workRoom, -0.633, 2.6, -0.4)
	flat.add(workRoom)

	const desk = new THREE.Group()
	desk.add(
		bar(2.0, 0.12, 0, 0.86, mat.flat), // top
		bar(0.1, 0.86, -0.9, 0.43, mat.flat), // legs
		bar(0.1, 0.86, 0.9, 0.43, mat.flat),
		bar(0.5, 0.36, 0.25, 1.22, mat.flat), // a screen, edge on
		bar(0.12, 0.16, 0.25, 0.96, mat.flat),
	)
	place(desk, -0.5, 1.5, -0.2)
	flat.add(desk)

	const chair = new THREE.Group()
	chair.add(
		bar(0.62, 0.1, 0, 0.62, mat.flat), // seat
		bar(0.1, 0.66, -0.26, 0.95, mat.flat), // back
		bar(0.08, 0.62, 0, 0.31, mat.flat), // stem
		bar(0.6, 0.07, 0, 0.04, mat.flat), // foot
	)
	place(chair, -0.617, 1.5, -0.25)
	flat.add(chair)

	// Top right: the kitchen table, and the bed beside it.
	const homeRoom = room(5.6, 3.2, mat.steelLt)
	place(homeRoom, 0.6, 2.6, -0.4)
	flat.add(homeRoom)

	const kitchen = new THREE.Group()
	kitchen.add(
		bar(1.7, 0.12, 0, 0.9, mat.flat),
		bar(0.1, 0.9, -0.72, 0.45, mat.flat),
		bar(0.1, 0.9, 0.72, 0.45, mat.flat),
	)
	const plate = new THREE.Mesh(
		track(new THREE.CircleGeometry(0.17, 20)),
		mat.flat,
	)
	plate.position.set(0.25, 1.02, 0)
	kitchen.add(plate)
	place(kitchen, 0.511, 1.5, -0.2)
	flat.add(kitchen)

	const bed = new THREE.Group()
	bed.add(
		bar(2.0, 0.44, 0, 0.42, mat.flat), // mattress
		bar(0.14, 0.9, -1.0, 0.55, mat.flat), // headboard
		bar(0.5, 0.2, -0.66, 0.74, mat.flat), // pillow
		bar(0.09, 0.22, 0.95, 0.11, mat.flat), // feet
		bar(0.09, 0.22, -0.95, 0.11, mat.flat),
	)
	place(bed, 0.778, 1.5, -0.2)
	flat.add(bed)

	scene.add(flat)

	// ─── Bottom left: the bike ────────────────────────────────────────────────

	const bike = new THREE.Group()
	const wheelGeometry = track(new THREE.RingGeometry(0.3, 0.36, 28))
	const wheelL = new THREE.Mesh(wheelGeometry, mat.steel)
	const wheelR = new THREE.Mesh(wheelGeometry, mat.steel)
	wheelL.position.set(-0.62, 0.36, 0)
	wheelR.position.set(0.62, 0.36, 0)
	// Spokes, so the spin is visible at all.
	for (const wheel of [wheelL, wheelR]) {
		wheel.add(
			bar(0.6, 0.035, 0, 0, mat.steel),
			bar(0.6, 0.035, 0, 0, mat.steel, Math.PI / 2),
		)
	}
	bike.add(
		wheelL,
		wheelR,
		bar(1.0, 0.06, 0, 0.62, mat.steel, -0.12), // top tube
		bar(0.72, 0.06, -0.18, 0.5, mat.steel, 0.85), // down tube
		bar(0.62, 0.06, 0.4, 0.55, mat.steel, -1.1), // seat tube
		bar(0.34, 0.06, 0.52, 0.92, mat.steel), // handlebar
		bar(0.3, 0.07, -0.5, 0.86, mat.steel), // saddle
	)
	place(bike, -0.622, -3.5, -0.2)
	scene.add(bike)

	// Speed lines, only while he is actually riding.
	const speedLines = new THREE.Group()
	for (let i = 0; i < 3; i++) {
		speedLines.add(bar(0.6, 0.05, -1.25 - i * 0.12, 0.45 + i * 0.3, mat.steel))
	}
	speedLines.position.copy(bike.position)
	speedLines.visible = false
	scene.add(speedLines)

	// ─── Bottom middle: the river, the tree, the friends ──────────────────────

	const river = new THREE.Group()
	river.add(
		bar(7.4, 0.09, 0, 0, mat.steelLt),
		bar(6.2, 0.06, -0.3, -0.28, mat.steelLt),
		bar(4.4, 0.06, 0.8, -0.54, mat.steelLt),
	)
	place(river, 0, -4.15, -0.3)
	scene.add(river)

	const tree = new THREE.Group()
	const canopy = new THREE.Mesh(
		track(new THREE.CircleGeometry(0.85, 28)),
		mat.steel,
	)
	canopy.position.set(0, 2.05, 0)
	const canopyL = new THREE.Mesh(
		track(new THREE.CircleGeometry(0.5, 24)),
		mat.steel,
	)
	canopyL.position.set(-0.68, 1.72, 0)
	const canopyR = new THREE.Mesh(
		track(new THREE.CircleGeometry(0.44, 24)),
		mat.steel,
	)
	canopyR.position.set(0.66, 1.66, 0)
	tree.add(canopy, canopyL, canopyR, bar(0.17, 1.5, 0, 0.75, mat.steel))
	place(tree, -0.211, -3.5, -0.25)
	scene.add(tree)

	const picnic = new THREE.Group()
	picnic.add(bar(2.3, 0.1, 0, 0, mat.steelLt)) // the blanket, edge on
	const friendA = makeFigure(mat.steel)
	const friendB = makeFigure(mat.steel)
	friendA.root.scale.setScalar(1.05)
	friendA.root.position.set(-0.55, 0.06, 0.01)
	friendB.root.scale.set(-1.05, 1.05, 1.05) // facing the other way
	friendB.root.position.set(0.62, 0.06, 0.01)
	sit(friendA, 0.12)
	sit(friendB, 0.12)
	picnic.add(friendA.root, friendB.root)
	// A basket between them.
	picnic.add(bar(0.34, 0.24, 0.04, 0.12, mat.steel))
	place(picnic, 0.083, -3.45, -0.2)
	scene.add(picnic)

	// ─── Bottom right: the doctor ─────────────────────────────────────────────

	const surgery = new THREE.Group()
	const surgeryRoom = room(4.2, 3.0, mat.steelLt)
	surgery.add(surgeryRoom)
	// The cross on the wall — the one place Signal is allowed besides him.
	surgery.add(
		bar(0.5, 0.16, 1.4, 1.0, mat.signal),
		bar(0.16, 0.5, 1.4, 1.0, mat.signal),
	)
	// A couch to wait on.
	surgery.add(bar(1.2, 0.12, -1.15, 0.15, mat.steel))
	place(surgery, 0.689, -2.7, -0.4)
	scene.add(surgery)

	const doctor = makeFigure(mat.steel)
	doctor.root.scale.set(-1.1, 1.1, 1.1) // turned towards the patient
	place(doctor.root, 0.722, -3.5, -0.15)
	scene.add(doctor.root)

	// ─── The clock, top middle ────────────────────────────────────────────────
	// A disc that shrinks to nothing. Reading it needs no numbers and no German.

	const clock = new THREE.Group()
	clock.add(
		new THREE.Mesh(track(new THREE.RingGeometry(0.76, 0.8, 48)), mat.steel),
	)
	const clockFill = new THREE.Mesh(
		track(new THREE.CircleGeometry(0.72, 48)),
		mat.clock,
	)
	clock.add(clockFill)
	place(clock, 0, 3.15, 0.2)
	scene.add(clock)

	// ─── Him ──────────────────────────────────────────────────────────────────

	const hero = makeFigure(mat.ink)
	const HERO_SCALE = 1.15
	hero.root.position.set(home.x, home.y, depth(home.y))
	scene.add(hero.root)

	// The one spot of Signal that moves: this is the one you are keeping alive.
	const marker = new THREE.Mesh(rect(0.15, 0.15), mat.signal)
	marker.position.set(0, 0, 0.02)
	hero.torso.add(marker)

	// The cardboard he sleeps under once the flat is gone.
	const box = new THREE.Group()
	box.add(
		new THREE.Mesh(roundedRect(1.15, 0.55, 0.03), mat.steel),
		bar(1.25, 0.05, 0, 0.28, mat.steel),
	)
	box.position.set(0, roughHome.y + 0.27, depth(roughHome.y, -0.2))
	box.visible = false
	scene.add(box)

	// Where he ends up, if he ends up.
	const grave = new THREE.Mesh(rect(1.6, 0.06), mat.signal)
	grave.visible = false
	scene.add(grave)

	// ─── Rain, for when the mind goes ─────────────────────────────────────────

	const rain = new THREE.Group()
	const dropGeometry = rect(0.02, 0.34)
	const drops: Array<{ mesh: Mesh; speed: number }> = []
	for (let i = 0; i < 80; i++) {
		const mesh = new THREE.Mesh(dropGeometry, mat.rain)
		mesh.position.set(
			(Math.random() - 0.5) * 40,
			-WORLD_HEIGHT / 2 + Math.random() * WORLD_HEIGHT,
			1,
		)
		drops.push({ mesh, speed: 3.4 + Math.random() * 3 })
		rain.add(mesh)
	}
	rain.visible = false
	scene.add(rain)

	// ─── Movement state ───────────────────────────────────────────────────────

	const motion = options.reducedMotion ? 0.3 : 1
	type Mode = 'idle' | 'walk' | 'busy' | 'return'
	let mode: Mode = 'idle'
	/** The station he is heading for, working at, or coming back from. */
	let station: GlyphName | null = null
	const pos: Vec = { ...home }
	let facing = 1
	let walkPhase = 0
	let workPhase = 0
	let holdTimer = 0
	let width = 1
	let height = 1
	let visibleWidth = 18

	function resize(nextWidth: number, nextHeight: number) {
		width = Math.max(1, nextWidth)
		height = Math.max(1, nextHeight)
		renderer.setSize(width, height, false)
		const aspect = width / height
		// The full height is always visible; on a canvas too narrow to hold even
		// the tightest plan, zoom out rather than crop it.
		const frustumHeight = Math.max(WORLD_HEIGHT, (MIN_SPREAD * 2) / aspect)
		const frustumWidth = frustumHeight * aspect
		visibleWidth = frustumWidth
		// Re-space the plan so a short, wide canvas gets a wide, short life.
		applyLayout(Math.min(frustumWidth / 2, MAX_SPREAD))
		camera.left = -frustumWidth / 2
		camera.right = frustumWidth / 2
		camera.top = frustumHeight / 2
		camera.bottom = -frustumHeight / 2
		camera.updateProjectionMatrix()
	}

	/** Step `pos` towards `to`; true once it has arrived. */
	function moveTowards(to: Vec, step: number) {
		const dx = to.x - pos.x
		const dy = to.y - pos.y
		const distance = Math.hypot(dx, dy)
		if (distance <= step) {
			pos.x = to.x
			pos.y = to.y
			return true
		}
		pos.x += (dx / distance) * step
		pos.y += (dy / distance) * step
		if (Math.abs(dx) > 0.02) facing = dx > 0 ? 1 : -1
		return false
	}

	function render(view: SceneView, dt: number) {
		const step = Math.min(dt, 0.1)
		const anchor = view.obdachlos ? roughHome : home

		// A click always wins: he drops what he is doing and heads over.
		if (view.pulse && !view.dead) {
			station = view.pulse
			mode = 'walk'
		}

		if (view.dead) {
			mode = 'idle'
			station = null
		} else if (mode === 'walk' && station) {
			if (moveTowards(stations[station], WALK_SPEED * step)) {
				mode = 'busy'
				holdTimer = stations[station].hold
				workPhase = 0
			}
		} else if (mode === 'busy') {
			holdTimer -= step
			workPhase += step
			if (holdTimer <= 0) mode = 'return'
		} else if (mode === 'return') {
			if (moveTowards(anchor, WALK_SPEED * 0.82 * step)) {
				mode = 'idle'
				station = null
			}
		} else if (
			// Losing the flat moves the middle of his life; he drifts to the box.
			Math.hypot(anchor.x - pos.x, anchor.y - pos.y) > 0.05
		) {
			moveTowards(anchor, WALK_SPEED * 0.6 * step)
		}

		// ── Posing ────────────────────────────────────────────────────────────
		stand(hero)
		const wear = 1 - Math.min(view.koerper, view.geist) / 100
		const hunch = Math.min(1, wear * (view.obdachlos ? 1.3 : 1))
		let y = pos.y
		let riding = false

		if (view.dead) {
			hero.root.rotation.z = -Math.PI / 2
			y = pos.y + 0.2
			grave.visible = true
			grave.position.set(pos.x, pos.y + 0.03, depth(pos.y, 0.05))
		} else {
			grave.visible = false
			if (mode === 'walk' || mode === 'return') {
				walkPhase += step * 11 * motion
				const swing = Math.sin(walkPhase) * 0.55 * motion
				hero.legL.rotation.z = swing
				hero.legR.rotation.z = -swing
				y += Math.abs(Math.sin(walkPhase)) * 0.035 * motion
				hero.torso.rotation.z = -hunch * 0.4
				hero.head.position.set(hunch * 0.13, 1.16 - hunch * 0.16, 0)
			} else if (mode === 'busy' && station) {
				poseAtStation(station)
			} else {
				// Idle: breathing, and the same bend the meters dictate.
				hero.torso.rotation.z = -hunch * 0.4
				hero.torso.position.y = 0.68 - hunch * 0.06
				hero.head.position.set(hunch * 0.13, 1.16 - hunch * 0.16, 0)
				y += Math.sin(performance.now() / 900) * 0.012 * motion
				if (view.obdachlos) {
					sit(hero, -0.45)
					y -= 0.45
				}
			}
		}

		function poseAtStation(id: GlyphName) {
			switch (id) {
				case 'arbeiten': {
					// On the chair, leant into the screen, nodding at it.
					sit(hero, -0.3)
					hero.head.position.x = 0.16 + Math.sin(workPhase * 3) * 0.02 * motion
					break
				}
				case 'essen': {
					// Standing at the table, bobbing down to the plate.
					hero.torso.rotation.z = -0.25
					hero.head.position.set(
						0.12,
						1.1 - Math.abs(Math.sin(workPhase * 2.2)) * 0.1 * motion,
						0,
					)
					break
				}
				case 'schlafen': {
					// Lying on the mattress. Turning the other way from the death
					// pose, so his head ends up on the pillow rather than at the
					// foot of the bed.
					hero.root.rotation.z = Math.PI / 2
					hero.legL.rotation.z = -0.3
					hero.legR.rotation.z = -0.16
					break
				}
				case 'sport': {
					// Pedalling: the legs go round, not back and forth.
					riding = true
					const pedal = workPhase * 7 * motion
					hero.legL.rotation.z = pedal
					hero.legR.rotation.z = pedal + Math.PI
					hero.torso.rotation.z = -0.5
					hero.head.position.set(0.3, 1.06, 0)
					break
				}
				case 'freunde': {
					sit(hero, 0.1)
					break
				}
				case 'arzt': {
					// Standing still while someone finally looks at him.
					hero.torso.rotation.z = -0.06
					break
				}
			}
		}

		hero.root.position.set(pos.x, y, depth(pos.y, 0.02))
		hero.root.scale.set(HERO_SCALE * facing, HERO_SCALE, HERO_SCALE)
		if (view.krank && mode === 'idle' && !view.dead) {
			hero.root.rotation.z = Math.sin(walkPhase * 0.4) * 0.06
		}

		// The bike carries him along while he rides it.
		if (riding) {
			bike.position.set(pos.x, pos.y - 0.02, depth(pos.y, -0.02))
			speedLines.position.copy(bike.position)
			speedLines.visible = true
			const spin = -workPhase * 7 * motion
			wheelL.rotation.z = spin
			wheelR.rotation.z = spin
		} else {
			bike.position.set(
				stations.sport.x,
				stations.sport.y - 0.02,
				depth(stations.sport.y, -0.2),
			)
			speedLines.visible = false
		}

		// ── World state ───────────────────────────────────────────────────────
		box.visible = view.obdachlos && !view.dead
		// The flat is still drawn once it is lost, but greyed: it exists, it is
		// simply no longer his.
		mat.flat.color.set(view.obdachlos ? colors.steelLt : colors.steel)

		const ratio = Math.max(0, Math.min(1, view.zeitRatio))
		clockFill.scale.setScalar(Math.max(0.001, ratio))
		mat.clock.color.set(ratio < 0.25 ? colors.signal : colors.ink)

		rain.visible = view.depressiv && !view.dead
		if (rain.visible) {
			for (const drop of drops) {
				drop.mesh.position.y -= drop.speed * step * motion
				if (drop.mesh.position.y < -WORLD_HEIGHT / 2) {
					drop.mesh.position.y = WORLD_HEIGHT / 2
					drop.mesh.position.x = (Math.random() - 0.5) * visibleWidth
				}
			}
		}

		renderer.render(scene, camera)
	}

	function setDark(dark: boolean) {
		const next = dark ? PALETTE.dark : PALETTE.light
		Object.assign(colors, next)
		mat.ink.color.set(next.ink)
		mat.steel.color.set(next.steel)
		mat.steelLt.color.set(next.steelLt)
		mat.signal.color.set(next.signal)
		mat.rain.color.set(next.steel)
		mat.flat.color.set(next.steel)
		renderer.setClearColor(next.paper, 1)
	}

	function dispose() {
		for (const geometry of geometries) geometry.dispose()
		for (const material of materials) material.dispose()
		renderer.dispose()
		scene.clear()
	}

	resize(canvas.clientWidth || 800, canvas.clientHeight || 400)

	return { render, resize, setDark, dispose }
}
