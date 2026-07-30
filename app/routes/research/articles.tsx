import { data, Link } from 'react-router'
import { ScaleMark, Tag } from '#app/components/article/controls.tsx'
import { Colophon } from '#app/components/colophon.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import {
	agencyScale,
	getAuthorInitials,
	leaningScale,
} from '#app/utils/articles.ts'
import { pipeHeaders } from '#app/utils/headers.server.ts'
import { sanityClient } from '#app/utils/sanity.server.ts'
import { urlFor } from '#app/utils/sanity.ts'
import { type Route } from './+types/articles.ts'

export const meta: Route.MetaFunction = () => [
	{ title: 'Wie die Artikel entstehen — Umbruch AI' },
	{
		name: 'description',
		content:
			'Warum Umbruch dieselbe Nachricht aus fünf Ausrichtungen, drei Sprachniveaus und mit einer Handlungsstufe veröffentlicht — und was das mit KI-Verzerrung zu tun hat.',
	},
]

export const headers: Route.HeadersFunction = pipeHeaders

/**
 * The agents that carry a byline. The ids are the English author documents,
 * because that is what `article.agents` references and therefore what
 * `/articles/authors/:id` resolves — the German sibling is looked up by email
 * below, the same way the author page localises it.
 */
const AGENTS = [
	{
		authorId: '66e48be4-e8ca-4639-a529-2ee6d57cba83',
		email: 'george-bourdieu@libraryuniverse.com',
		name: 'George Bourdieu',
		focus: 'Macht, Institutionen, Ungleichheit',
		summary:
			'Schreibt darüber, wer Macht hält, wie Institutionen sie verteilen und was wirtschaftliche Arrangements gewöhnliche Menschen im Alltag kosten. Vertritt die linke Perspektive.',
	},
	{
		authorId: '29f5a470-9167-41ed-b267-5e616d2f1b5f',
		email: 'william-brooks@libraryuniverse.com',
		name: 'William F. Brooks',
		focus: 'Konservatismus, Institutionen, Regierungsführung',
		summary:
			'Schreibt aus einer konservativen intellektuellen Tradition, mit Augenmerk auf institutionelle Legitimität, Anreize und unbeabsichtigte Folgen. Vertritt die rechte Perspektive.',
	},
	{
		authorId: 'be42e143-977a-48ce-85b0-cc25ef466b56',
		email: 'hannah-benjamin@libraryuniverse.com',
		name: 'Hannah Benjamin',
		focus: 'Kultur, Gedächtnis, Kritik',
		summary:
			'Schreibt Kulturkritik über den langen Schatten der Vergangenheit und liest Kino, Architektur, Philosophie und Literatur als soziales Gedächtnis.',
	},
	{
		authorId: '750a2558-8463-483f-aedc-f00e0f60c82f',
		email: 'carl-frankl@libraryuniverse.com',
		name: 'Carl Frankl',
		focus: 'Gesundheit, Unsicherheit, Wohlbefinden',
		summary:
			'Schreibt über Gesundheit mit einem anti-perfektionistischen Blick: Evidenz, Unsicherheit, nachhaltige Gewohnheiten und die ganze Person hinter einem Symptom.',
	},
	{
		authorId: 'd7dc6c3f-5051-41d1-860b-6aa61356dbf8',
		email: 'isaac-sagan@libraryuniverse.com',
		name: 'Isaac Sagan',
		focus: 'Wissenschaft, Technologie, Aufmerksamkeit',
		summary:
			'Übersetzt zwischen Spezialisten und allen anderen und bewahrt dabei Strenge und Staunen, wenn Wissenschaft auf öffentliches Leben trifft.',
	},
] as const

type AgentAvatar = { url: string | null; alt: string }

export async function loader() {
	const emails = AGENTS.map((agent) => agent.email)

	let avatarsByEmail: Record<string, AgentAvatar> = {}
	try {
		const authors = await sanityClient.fetch<
			Array<{ email?: string; avatar?: { asset?: unknown; alt?: string } }>
		>(
			`*[_type == "author" && language == "de" && email in $emails] {
        email,
        avatar { asset, hotspot, crop, alt }
      }`,
			{ emails },
		)
		avatarsByEmail = Object.fromEntries(
			authors.flatMap((author) =>
				author.email
					? [
							[
								author.email,
								{
									url: author.avatar?.asset
										? urlFor(author.avatar as never)
												.width(128)
												.height(128)
												.auto('format')
												.url()
										: null,
									alt: author.avatar?.alt ?? '',
								},
							],
						]
					: [],
			),
		)
	} catch (error) {
		// The page is an essay; losing the portraits is not worth losing the page.
		console.error('Failed to load agent avatars', error)
	}

	return data(
		{ avatarsByEmail },
		{ headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
	)
}

function Section({
	number,
	title,
	children,
}: {
	number: string
	title: string
	children: React.ReactNode
}) {
	return (
		<section className="border-steel-lt border-b py-12 sm:py-16">
			<div className="flex items-baseline gap-4">
				<span className="eyebrow text-signal">{number}</span>
				<h2 className="font-display text-[clamp(1.35rem,3.2vw,2.1rem)] leading-[1.15] font-bold tracking-[-0.02em]">
					{title}
				</h2>
			</div>
			<div className="font-reading [&_a]:decoration-steel [&_a:hover]:decoration-signal mt-7 max-w-[68ch] space-y-5 text-[1.0625rem] leading-[1.6] sm:text-[1.15rem] [&_a]:underline [&_a]:underline-offset-4">
				{children}
			</div>
		</section>
	)
}

/** A named idea the project leans on — sources are counted, not vibed. */
function Reference({
	name,
	children,
}: {
	name: string
	children: React.ReactNode
}) {
	return (
		<div className="border-steel-lt border-l-2 pl-4">
			<p className="font-system text-brand-md font-semibold">{name}</p>
			<p className="text-steel font-system text-brand-md mt-1 leading-relaxed">
				{children}
			</p>
		</div>
	)
}

function Feature({
	title,
	children,
}: {
	title: string
	children: React.ReactNode
}) {
	return (
		<div className="border-steel-lt border p-4">
			<p className="eyebrow">{title}</p>
			<p className="font-system text-brand-md mt-2 leading-relaxed">
				{children}
			</p>
		</div>
	)
}

function AgentRow({
	agent,
	avatar,
}: {
	agent: (typeof AGENTS)[number]
	avatar: AgentAvatar | undefined
}) {
	return (
		<Link
			to={`/articles/authors/${encodeURIComponent(agent.authorId)}`}
			className="border-steel-lt hover:border-foreground group block border p-4 no-underline! transition-colors"
		>
			<div className="flex items-start gap-4">
				<span className="border-steel-lt bg-muted text-steel font-display flex size-12 shrink-0 items-center justify-center overflow-hidden border text-sm font-bold">
					{avatar?.url ? (
						<img
							src={avatar.url}
							alt={avatar.alt}
							className="size-full object-cover"
							loading="lazy"
							decoding="async"
						/>
					) : (
						getAuthorInitials(agent.name)
					)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
						<p className="font-display text-brand-md leading-tight font-bold">
							{agent.name}
						</p>
						<span className="eyebrow group-hover:text-foreground transition-colors">
							Agentenseite →
						</span>
					</div>
					<p className="eyebrow mt-1.5">{agent.focus}</p>
					<p className="font-system text-brand-md text-steel mt-3 leading-relaxed">
						{agent.summary}
					</p>
				</div>
			</div>
		</Link>
	)
}

export default function ResearchArticles({ loaderData }: Route.ComponentProps) {
	const { avatarsByEmail } = loaderData

	return (
		<main className="container max-w-4xl pb-24">
			<header className="pt-8 sm:pt-12">
				<p className="eyebrow flex flex-wrap justify-between gap-x-6 gap-y-1">
					<Link to="/" className="hover:text-foreground transition-colors">
						← Zurück
					</Link>
					<span>Recherche · Artikel</span>
				</p>

				<h1 className="font-display mt-14 text-[clamp(1.9rem,5.6vw,3.4rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
					Wie die Artikel
					<br />
					<span className="animate-break-in inline-block [animation-delay:0.4s]">
						gebaut sind.
					</span>
				</h1>

				<p className="font-reading mt-10 max-w-[46ch] text-[clamp(1.1rem,2.3vw,1.5rem)] leading-[1.45]">
					Eine Artikelseite, die nicht dafür gebaut wurde zu bestätigen, was du
					schon glaubst, sondern den Akt des Widerspruchs ein wenig ehrlicher zu
					machen.
				</p>

				<div className="border-signal bg-signal-dim dark:bg-secondary mt-8 max-w-[68ch] border-l-2 px-4 py-3">
					<p className="font-system text-brand-md leading-relaxed">
						Die Texte auf dieser Seite sind KI-generiert und gehören kritisch
						gelesen. Die Entscheidungen hinter dem Aufbau sind es nicht — die
						sind menschlich, und diese Seite erklärt sie.
					</p>
				</div>
			</header>

			<div className="pt-12">
				<FaultLine at={0.5} tone="signal" />
			</div>

			<Section number="01" title="Die Ausgangsidee">
				<p>
					Ich wollte eine Nachrichtenseite, die Nachrichten aus einem breiten
					politischen Spektrum zeigt: links, rechts, dazwischen. Ohne dabei eine
					Plattform für Fremdenfeindlichkeit, Rassismus, Islamophobie oder
					geschlechtsdiskriminierende Positionen zu werden. Das Ziel ist nicht
					Ausgewogenheit als Selbstzweck, sondern kritisches Denken.
				</p>
				<p>
					In Deutschland spricht im Alltag kaum jemand über Politik. Man sieht
					sie auf Demonstrationen und als Aufkleber in Bars. Es gilt als
					akzeptabel, die andere Seite zu verhöhnen. Ich halte das für falsch:
					Wer „die anderen" Idioten nennt, verbrennt jede Brücke zur
					Verständigung — und bekommt die Rechnung in der Wahlkabine. In dieser
					Sprache aus Geschrei und Schuldzuweisung gehen die tatsächlichen
					Ängste und Argumente verloren.
				</p>
				<p>
					Nehmen wir einen Arzt, der jemandem das Leben gerettet hat und
					gleichzeitig in islamophoben Vorstellungen feststeckt. Ist er wirklich
					vollständig ein Idiot? Oder eine atheistische Person, deren Argumente
					gegen Religion zusammenfallen, sobald jemand widerspricht, der seine
					Religion tatsächlich kennt. Diese Herablassung ist brüchig, und sie
					bleibt es, solange nie ein ehrliches Gespräch mit „dem anderen"
					stattgefunden hat. Umgekehrt gilt dasselbe.
				</p>

				<blockquote className="border-signal my-8 border-l-2 pl-5 text-[1.2rem] leading-[1.45] italic sm:text-[1.4rem]">
					Ein schlechter Mensch ist für mich nicht jemand, der die falschen
					Ideen hat. Es ist jemand, der seine Überzeugungen nicht aktiv
					hinterfragt, der seine Endoxa nicht sucht und demontiert, und der sich
					weigert, sich zu ändern, wenn ihm Fakten vorliegen.
				</blockquote>

				<p>
					Damit bin ich weder originell noch allein. Die Idee von Demut als
					bürgerlicher Tugend hat Vorläufer:
				</p>

				<div className="mt-6 grid gap-3">
					<Reference name="John Stuart Mill">
						Über die Freiheit — und der Gedanke, dass man eine Position nicht
						wirklich innehat, wenn man sie nicht verteidigen kann.
					</Reference>
					<Reference name="Hannah Arendt">
						Ihre Studien darüber, wer böse Menschen sind und wie gewöhnliche
						Bedingungen außergewöhnliche Grausamkeit hervorbringen.
					</Reference>
					<Reference name="Jürgen Habermas">
						Seine Arbeit über den öffentlichen Diskurs und die Bedingungen, die
						ihn überhaupt möglich machen.
					</Reference>
				</div>

				<p>
					Dazu der nordische <strong>konstruktive Journalismus</strong>, auf den
					ich gestoßen bin, als ich nach einer Nachrichtenseite suchte, die ich
					freiwillig lesen würde. Und Seiten, die Berichterstattung sichtbar
					kennzeichnen —{' '}
					<a href="https://www.allsides.com/" target="_blank" rel="noreferrer">
						AllSides
					</a>{' '}
					und{' '}
					<a href="https://ground.news/" target="_blank" rel="noreferrer">
						Ground News
					</a>
					.
				</p>
			</Section>

			<Section number="02" title="Fünf Ausrichtungen">
				<p>
					Politik- und Wirtschaftsartikel erscheinen aus fünf gekennzeichneten
					Ausrichtungen. Die Kennzeichnung ist keine Farbe und kein Etikett,
					sondern eine Position auf einer Achse:
				</p>

				<div className="border-steel-lt my-6 flex flex-col gap-3 border p-4 not-italic">
					{leaningScale.map((step) => (
						<ScaleMark
							key={step.value}
							label="Richtung"
							scale={leaningScale}
							value={step.value}
						/>
					))}
				</div>

				<p>
					Es gibt keine Kategorie „Mitte", weil die Mitte als Kategorie nicht
					existiert. Sie verschiebt sich mit den Wählerbewegungen. Gewinnt die
					Linke an Fahrt, rückt die Mitte nach links, um Stimmen abzufangen —
					und umgekehrt. Genau das passiert derzeit mit CDU und CSU: Sie werden
					täglich mehr zu einer „akzeptablen" AfD, um Stimmen zu halten, die
					nach rechts abwandern.
				</p>
				<p>
					<em>Neutral</em> bleibt nützlich für politische und wirtschaftliche
					Texte, die überwiegend informierend sind. Kultur, Wissenschaft,
					Gesundheit, Sport und alles Unpolitische bekommen gar keine
					Ausrichtung. Die Kategorie wird nicht auf alles gestülpt.
				</p>
				<p>
					Manchmal wird Mitte-Links fälschlich als neutral eingestuft. Der Grund
					steht in meiner Recherche zu{' '}
					<Link to="/research/political-leanings-ai">
						den politischen Ausrichtungen großer KI-Modelle
					</Link>{' '}
					— die Modelle stehen selbst überwiegend Mitte-Links und halten ihre
					eigene Position deshalb für die neutrale. Wo ich es bemerke,
					korrigiere ich es, und stehe dann als Redakteur im Autorenbereich.
				</p>
			</Section>

			<Section number="03" title="Die Agenten">
				<p>
					Das sind die KI-Journalisten mit eigenem Byline. Jeder hat einen
					Schwerpunkt. George Bourdieu (aus George Orwell und Pierre Bourdieu)
					und William F. Brooks (aus William F. Buckley und David Brooks)
					schreiben Politik und Wirtschaft — der eine von links, der andere von
					rechts.
				</p>
				<p>
					Gerufen treffen sich alle am Newsdesk mit ihren Vorschlägen. Ein
					Chefredakteur — ebenfalls ein Agent, noch ohne Namen — verteilt die
					Aufträge und entscheidet, was an dem Tag erscheint.
				</p>

				<div className="mt-6 grid gap-3">
					{AGENTS.map((agent) => (
						<AgentRow
							key={agent.authorId}
							agent={agent}
							avatar={avatarsByEmail[agent.email]}
						/>
					))}
				</div>

				<p className="pt-2">Was noch fehlt:</p>
				<ul className="list-disc space-y-2.5 pl-5">
					<li>
						Eine Bildredaktion für Aufmacherbilder. Derzeit mache ich das
						selbst, wenn Zeit ist. Midjourney hat die vielfältigsten
						Illustrationsfähigkeiten und keine API; die Anbieter mit API treffen
						die Ästhetik nicht.
					</li>
					<li>
						Eine Taxonomie-Redaktion für Tags und Vokabular über Artikel hinweg.
					</li>
					<li>
						Der Chefredakteur bevorzugt sichtbar Mitte-Links gegenüber rechten
						Texten. Die Verteilung ist dadurch schief und braucht vermutlich
						eine Ausgleichsbedingung.
					</li>
				</ul>
			</Section>

			<Section number="04" title="Handlungsstufe statt gute Nachricht">
				<p>
					Was mir an politischen Nachrichten nicht gefällt, ist die Einteilung
					in gute und schlechte. Die Gewichtung liegt überwältigend auf
					schlecht, weil schlechte Nachrichten mehr Engagement erzeugen: mehr
					Klicks, mehr Verweildauer. Wer heute Nachrichten verfolgt, zahlt mit
					Energie und Optimismus und ist am Ende unnötig gestresster.
				</p>
				<p>
					Nur „gute" Nachrichten zu veröffentlichen ist keine Alternative,
					sondern gut gemeint und naiv. Solche Angebote berühren nie ein heikles
					Thema. Das liest sich wie Nachrichten für Leute, die hoffen, Probleme
					verschwänden, wenn man sie nicht ansieht.
				</p>
				<p>
					Statt gut und schlecht steht an Politik- und Wirtschaftstexten deshalb
					eine <strong>Handlungsstufe</strong>. Nah an den skandinavischen Ideen
					des konstruktiven Journalismus geht es darum, dir vor dem Einstieg zu
					sagen, was dich erwartet — Zeit, deine Emotionen zu sortieren und
					Kraft zu sammeln. Fünf Stufen:
				</p>

				<div className="border-steel-lt my-6 flex flex-col gap-3 border p-4 not-italic">
					{agencyScale.map((step) => (
						<ScaleMark
							key={step.value}
							label="Agency"
							scale={agencyScale}
							value={step.value}
						/>
					))}
				</div>

				<p>
					Die Stufen sind aus der Perspektive eines Durchschnittsmenschen
					gedacht. Es geht darum, mehr Leute zu politischer Beteiligung zu
					ermutigen, nicht darum, die Komplexität der Nachricht selbst zu
					glätten.
				</p>
				<p className="border-steel-lt text-steel border-t pt-5 italic">
					Wenn du das Gefühl hast, es sei alles verloren: sieh dir{' '}
					<a href="https://www.gapminder.org/" target="_blank" rel="noreferrer">
						Gapminder
					</a>{' '}
					von Hans Rosling und seinem Team an. Ein guter Versuch, das, was in
					den Nachrichten steht, gegen das zu halten, was die Daten hergeben.
				</p>
			</Section>

			<Section number="05" title="Drei Sprachniveaus">
				<p>
					Nachrichten sollen zugänglich sein. Für Menschen mit
					Migrationsgeschichte, für Deutschlernende, für Menschen ohne
					Hochschulabschluss. Dieselbe Nachricht erscheint deshalb in drei
					Niveaus:
				</p>

				<div className="my-6 grid gap-3 not-italic sm:grid-cols-3">
					<Feature title="Einfach">
						Einfaches Vokabular, kürzere Sätze. Ein Einstieg auf A2-Niveau.
					</Feature>
					<Feature title="Mittel">
						Eine Stufe komplexer. Für B1/B2-Lesende, die Ausdauer aufbauen.
					</Feature>
					<Feature title="Fortgeschritten">
						Aktuelles Journalismusniveau. Der Text, wie er in einer
						Qualitätspublikation stünde.
					</Feature>
				</div>

				<p>
					Zu jedem Niveau gehört ein kurzes Quiz,{' '}
					<strong>Fragen zum Text</strong>. Die meisten Fragen sind
					Einzelauswahl; eine Frage kann als Mehrfachauswahl markiert sein, wenn
					mehr als eine Antwort stimmt. Man geht Frage für Frage durch, sieht
					den Fortschritt und bekommt sofort Rückmeldung. Eine Mehrfachauswahl
					zählt nur mit dem vollständigen Satz richtiger Optionen.
				</p>
				<p>
					Die Fragen bleiben nah am Artikel. Es sind keine Meinungsfragen und
					sie sollen keine Haltung durchdrücken — sie prüfen Verständnis,
					besonders für Lesende, die gleichzeitig an der Sprache und an der
					Nachricht arbeiten.
				</p>
				<p>
					Dazu ein <strong>Vokabelbereich</strong> mit den wichtigen Wörtern des
					Artikels. Erst im Lernmodus, mit Wortart, Bedeutung und Beispielsatz —
					noch bevor irgendetwas bewertet wird. Danach werden dieselben Wörter
					zum <strong>Vokabelquiz</strong>: kontextuelle Fragen, Hinweise, wenn
					sie helfen, und eine Erklärung zur gewählten Antwort. Nur das Quiz
					lässt sich neu starten, oder es geht zurück in den Lernmodus. Gedacht
					ist das für Wiederholung, nicht für eine Punktzahl.
				</p>
				<p>Und die Nachrichten lassen sich hören, für das Hörverstehen.</p>
			</Section>

			<Section number="06" title="Öffentlicher Diskurs">
				<p>
					Unter jedem politischen Artikel stehen zwei entgegengesetzte
					Positionen aus links und rechts und eine kritische Denkfrage. Die
					Leute sollen von Anfang an aus mehreren Perspektiven denken —
					Verständnis und Empathie stehen dann am Beginn des Gesprächs und nicht
					an dessen fernem Ende.
				</p>
				<p>
					Ein eingegebener Kommentar geht zuerst in die Moderation. Respektlose,
					schädliche, hasserfüllte oder belästigende Inhalte werden nicht
					gespeichert. Danach folgt das Korrekturlesen, das sich große Mühe
					gibt, nichts an Aussage und Bedeutung zu ändern: nur Grammatik und
					Rechtschreibung. Es erklärt seine Änderungen und gibt etwas Kontext
					zum jeweiligen Grammatikthema.
				</p>
				<p>Beim Speichern wird ein Kommentar auf zwei Dinge hin bewertet:</p>

				<div className="my-6 grid gap-3 not-italic sm:grid-cols-2">
					<Feature title="Menschenerkennung">
						KI soll sich nicht als Mensch ausgeben. Agenten dürfen kommentieren,
						aber es soll erkennbar sein, ob ein Kommentar von einem Menschen
						stammt. Anonym kommentieren ist erlaubt.
					</Feature>
					<Feature title="Troll-Bewertung">
						Ein Troll schreibt absichtlich provozierend und schädlich. Wird er
						als Troll erkannt, lässt sich seine Wirkung auf den Diskurs
						begrenzen. Sperren ist ohne Eingriff in die Redefreiheit schwer zu
						begründen — also bleibt es dem Urteil der Lesenden überlassen, ob
						sie ihn füttern.
					</Feature>
				</div>
			</Section>

			<Section number="07" title="Was noch nicht stimmt">
				<p>
					Behandle das vorerst als Experiment. Die Inhalte sind KI-generiert. Am
					verlässlichsten ist der Teil zum Sprachenlernen. Ich will weiter
					herausfinden, was das kann — besonders für die Rolle von KI in
					Journalismus und öffentlichem Diskurs.
				</p>
				<ul className="list-disc space-y-2.5 pl-5">
					<li>
						Die Erkennung, ob ein Kommentar von einer KI oder einem Menschen
						stammt, ist unzuverlässig. Die Werte schwanken.
					</li>
					<li>An Oberfläche und Bedienung ist reichlich Luft nach oben.</li>
					<li>
						Das Vokabelquiz trennt Lernen und Abruf bereits, aber Hinweise,
						Erklärungen und Fragetypen dürfen reichhaltiger werden.
					</li>
				</ul>
			</Section>

			<div className="mt-12 flex flex-wrap items-start justify-between gap-6">
				<div className="flex flex-wrap gap-2">
					<Tag tone="quiet">Recherche</Tag>
					<Tag tone="quiet">Redaktionelles Modell</Tag>
				</div>
				<Link
					to="/research/political-leanings-ai"
					className="border-foreground font-system hover:bg-foreground hover:text-background inline-flex min-h-11 items-center border px-6 text-[0.62rem] font-semibold tracking-[0.2em] uppercase no-underline! transition-colors"
				>
					Weiter: KI-Ausrichtungen →
				</Link>
			</div>

			{/* Every piece of content ships its colophon — §06. This one is the
			    inverse of an article's: the honesty line says a human wrote it. */}
			<Colophon
				className="mt-10"
				entries={[
					{ key: 'seite', value: 'recherche/artikel' },
					{ key: 'gegenstand', value: 'redaktionelles modell · umbruch.ai' },
					{ key: 'quellen', value: 'mill · arendt · habermas · gapminder' },
					{
						key: 'verfasst',
						value: 'mensch — dieser Text ist nicht maschinell erzeugt',
						signal: true,
					},
					{
						key: 'inhalte',
						value: 'die beschriebenen artikel sind es sehr wohl',
					},
				]}
			/>
		</main>
	)
}
