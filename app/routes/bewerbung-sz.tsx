import { useState } from 'react'
import { Link } from 'react-router'
import { Tag } from '#app/components/article/controls.tsx'
import { Colophon } from '#app/components/colophon.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import { type Route } from './+types/bewerbung-sz.ts'

export const meta: Route.MetaFunction = () => [
	{ title: 'Bewerbung: Volontariat mit dem Schwerpunkt MINT — Osman Cakir' },
	{
		name: 'description',
		content:
			'Osman Cakir bewirbt sich um das Volontariat mit dem Schwerpunkt MINT bei der Süddeutschen Zeitung (Beginn April 2027): Vorstellungsvideo, Anschreiben und Arbeitsproben auf einer Seite.',
	},
]

const VIDEO_ID = 'HChpqFY8_70'
const VIDEO_URL = `https://www.youtube.com/shorts/${VIDEO_ID}`

/** Straight from the job ad's profile, each answered with evidence, not adjectives. */
const REQUIREMENTS = [
	{
		asked: 'Verständnis von Studien und ihrer Entstehung',
		offered: (
			<>
				<Link to="/research/political-leanings-ai">Eigene LLM-Studie</Link>:
				Fragestellung, Prompts, Rohdaten und ein nachvollziehbares
				Bewertungsverfahren offengelegt. Dazu eine methodische Ausbildung in
				Ökonometrie und empirischer Wirtschaftsforschung.
			</>
		),
	},
	{
		asked: 'Einblicke in den Wissenschaftsbetrieb',
		offered:
			'Forschungsprojekt an der LMU (54.497 Kunstwerke, Mensch-KI-Verifikation), Mitarbeit am DataCite-Metadatengenerator der Universitätsbibliothek, Modellevaluation für das Städel Museum.',
	},
	{
		asked: 'Leidenschaft für Sprache und Textarbeit',
		offered: (
			<>
				<Link to="/research/articles">Redaktioneller Essay</Link> zu Umbruch AI
				selbst verfasst. Dieselbe Nachricht in drei Sprachniveaus konzipiert,
				vom Einstieg auf A2 bis zum Zeitungsdeutsch.
			</>
		),
	},
	{
		asked: 'Interesse an Debatten, Bereitschaft zur Meinungsäußerung',
		offered:
			'Im Essay beziehe ich klar Stellung zu Streitkultur und politischer Kennzeichnung. Die Studie liefert Daten zur Debatte über die politische Prägung von KI.',
	},
	{
		asked: 'Social Media und digitale Formate',
		offered: (
			<>
				Web-App, Audio,{' '}
				<Link to="/presentation-referat">interaktive Präsentation</Link>,
				Datenvisualisierung und Social-Media-Grafiken selbst umgesetzt.
			</>
		),
	},
	{
		asked: 'Offenheit für neue Themen und Werkzeuge',
		offered:
			'Eingearbeitet in Kunstgeschichte, Biometrie und Nachrichtenproduktion. Fehlende Werkzeuge baue ich im Zweifel selbst.',
	},
] as const

const SAMPLES = [
	{
		number: '1',
		title: 'Kein Modell antwortet neutral',
		to: '/research/political-leanings-ai',
		about:
			'Eine eigene Untersuchung politischer Tendenzen in sechs großen Sprachmodellen: alle 59 Aussagen des Political Compass auf Deutsch, Englisch und Türkisch, 1.062 Antworten ohne fehlende Werte. Befund: Fünf von sechs Modellen liegen im links-libertären Quadranten, und die Sprache der Frage verschiebt die gemessene Position.',
		why: 'Sie zeigt am deutlichsten, wie ich mit einer Studie umgehe: eine klare Fragestellung, ein Messverfahren, das ich offenlege, statt es zu übernehmen, Rohdaten zum Nachprüfen und eine Darstellung, die den Befund ohne Fachwissen lesbar macht. Die politische Prägung von KI ist zugleich eine wissenschaftliche und eine gesellschaftliche Frage.',
		share:
			'Alleinarbeit: Fragestellung, Studiendesign, Datenerhebung, Bewertungsverfahren, Auswertung, Visualisierung und Text.',
		figures: [
			{ value: '6', label: 'Sprachmodelle' },
			{ value: '59', label: 'Aussagen' },
			{ value: '3', label: 'Sprachen' },
			{ value: '1.062', label: 'Antworten' },
		],
	},
	{
		number: '2',
		title: 'Wie die Artikel gebaut sind',
		to: '/research/articles',
		about:
			'Ein Essay über die redaktionellen Entscheidungen hinter Umbruch AI: fünf gekennzeichnete politische Ausrichtungen, die Pflicht zur fairen Gegenposition, eine Handlungsstufe statt der Einteilung in gute und schlechte Nachrichten, drei Sprachniveaus für zugänglichere Nachrichten. Der Text benennt auch, was noch nicht funktioniert, etwa dass der Chefredakteurs-Agent Mitte-Links-Texte sichtbar bevorzugt.',
		why: 'Er ist mein längster eigener Text und zeigt, dass ich argumentieren und Position beziehen kann, mit Bezug auf Mill, Arendt und Habermas. Und er zeigt, wie ich die Grenzen einer KI-Anwendung offen beschreibe, statt sie zu verkaufen.',
		share:
			'Alleinarbeit: Konzept und Text. Die Seite ist ausdrücklich als von einem Menschen verfasst gekennzeichnet.',
	},
	{
		number: '3',
		title: 'Umbruch AI: interaktive Präsentation',
		to: '/presentation-referat',
		about:
			'Eine browserbasierte Präsentation des Gesamtprojekts: Problemstellung, Untersuchungsdesign, Redaktions-Agenten, politische Kennzeichnung, Handlungsstufen, barriereärmere Nachrichten und moderierte Diskussionskultur, mit einer Live-Demonstration der Lernformate.',
		why: 'Sie steht für die Vermittlung komplexer Inhalte in digitalen, visuellen Formaten, verbindet Storytelling mit Datenvisualisierung und zeigt, dass ich eigene Formate von der Idee bis zur Veröffentlichung umsetze.',
		share:
			'Alleinarbeit: Dramaturgie, Text, Gestaltung und technische Umsetzung.',
	},
] as const

const REPOSITORIES = [
	{
		name: 'ai-political-leanings',
		body: 'Daten, Auswertung und Visualisierung der Studie',
	},
	{
		name: 'umbruchai-news-desk',
		body: 'Recherche-, Pitch-, Prüf- und Publikationsworkflow',
	},
	{
		name: 'umbruchai',
		body: 'Publikation, CMS-Anbindung und Nutzeroberfläche',
	},
] as const

function Section({
	id,
	number,
	title,
	children,
}: {
	id: string
	number: string
	title: string
	children: React.ReactNode
}) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className="border-steel-lt scroll-mt-8 border-b py-12 sm:py-16"
		>
			<div className="flex items-baseline gap-4">
				<span className="eyebrow text-signal">{number}</span>
				<h2
					id={`${id}-title`}
					className="font-display text-[clamp(1.35rem,3.2vw,2.1rem)] leading-[1.15] font-bold tracking-[-0.02em]"
				>
					{title}
				</h2>
			</div>
			<div className="font-reading [&_a]:decoration-steel [&_a:hover]:decoration-signal mt-7 space-y-5 text-[1.0625rem] leading-[1.6] sm:text-[1.15rem] [&_a]:underline [&_a]:underline-offset-4">
				{children}
			</div>
		</section>
	)
}

function Prose({ children }: { children: React.ReactNode }) {
	return <div className="max-w-[68ch] space-y-5">{children}</div>
}

/**
 * The video stays a placeholder until asked for: nothing reaches YouTube on
 * page load, which is the only decent default for a German reader.
 */
function IntroVideo() {
	const [isLoaded, setIsLoaded] = useState(false)

	return (
		<div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
			<div className="bg-terminal text-terminal-tx border-steel-lt relative aspect-[9/16] w-full max-w-[18rem] shrink-0 overflow-hidden border">
				{isLoaded ? (
					<iframe
						src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
						title="Vorstellungsvideo von Osman Cakir"
						allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
						allowFullScreen
						className="absolute inset-0 size-full"
					/>
				) : (
					<button
						type="button"
						onClick={() => setIsLoaded(true)}
						className="group focus-visible:ring-signal absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
					>
						<span
							aria-hidden="true"
							className="border-signal group-hover:bg-signal flex size-16 items-center justify-center border transition-colors"
						>
							<svg
								viewBox="0 0 24 24"
								className="fill-signal group-hover:fill-terminal ml-1 size-6 transition-colors"
							>
								<path d="M6 4l14 8-14 8z" />
							</svg>
						</span>
						<span className="font-system text-[0.68rem] font-semibold tracking-[0.2em] uppercase">
							Video abspielen
						</span>
						<span className="font-system text-[0.68rem] leading-relaxed text-[#9ba0a5]">
							Beim Abspielen lädt der Player von YouTube, dabei werden Daten an
							Google übertragen.
						</span>
					</button>
				)}
			</div>

			<Prose>
				<p>
					Wer ich bin, was mich antreibt und warum ich zur Süddeutschen Zeitung
					will, in eigenen Worten und ohne Schnitt.
				</p>
				<blockquote className="border-signal border-l-2 pl-5 text-[1.15rem] leading-[1.45] italic sm:text-[1.3rem]">
					Mit Umbruch AI habe ich ausprobiert, was KI im Journalismus kann. Die
					Antwort ist: einiges, aber nicht das Entscheidende. Einordnen,
					nachfragen, Verantwortung übernehmen, das will ich von Menschen
					lernen, die es können.
				</blockquote>
				<p className="font-system text-brand-md text-steel">
					Lieber direkt auf YouTube?{' '}
					<a href={VIDEO_URL} target="_blank" rel="noreferrer">
						Video in neuem Tab öffnen ↗
					</a>
				</p>
			</Prose>
		</div>
	)
}

function Sample({ sample }: { sample: (typeof SAMPLES)[number] }) {
	return (
		<article className="border-steel-lt border p-5 sm:p-7">
			<p className="eyebrow">Arbeitsprobe {sample.number}</p>
			<h3 className="font-display mt-2 text-[clamp(1.2rem,2.6vw,1.6rem)] leading-tight font-bold tracking-[-0.01em]">
				<Link to={sample.to}>{sample.title}</Link>
			</h3>

			{'figures' in sample ? (
				<dl className="border-steel-lt mt-5 grid grid-cols-2 border-t border-l sm:grid-cols-4">
					{sample.figures.map((figure) => (
						<div
							key={figure.label}
							className="border-steel-lt flex flex-col-reverse border-r border-b px-4 py-3"
						>
							<dt className="eyebrow mt-1">{figure.label}</dt>
							<dd className="font-display text-signal text-[1.7rem] leading-none font-bold">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
			) : null}

			<div className="mt-5 max-w-[68ch] space-y-4">
				<p>{sample.about}</p>
				<p>
					<strong>Warum diese Arbeit:</strong> {sample.why}
				</p>
				<p>
					<strong>Mein Anteil:</strong> {sample.share}
				</p>
			</div>

			<Link
				to={sample.to}
				className="border-foreground font-system hover:bg-foreground hover:text-background mt-6 inline-flex min-h-11 items-center border px-5 text-[0.62rem] font-semibold tracking-[0.2em] uppercase no-underline! transition-colors"
			>
				Arbeit lesen →
			</Link>
		</article>
	)
}

export default function ApplicationSz() {
	return (
		<main className="container max-w-4xl pb-24">
			<header className="pt-8 sm:pt-12">
				<p className="eyebrow flex flex-wrap justify-between gap-x-6 gap-y-1">
					<Link to="/" className="hover:text-foreground transition-colors">
						← Zurück
					</Link>
					<span>Bewerbung · Volontariat MINT</span>
				</p>

				<p className="eyebrow mt-14">
					Osman Cakir · an die Volontärsausbildung der Süddeutschen Zeitung
				</p>
				<h1 className="font-display mt-4 text-[clamp(1.9rem,5.6vw,3.4rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
					Prüfen, einordnen,
					<br />
					<span className="animate-break-in inline-block [animation-delay:0.4s]">
						verständlich machen.
					</span>
				</h1>

				<p className="font-reading mt-10 max-w-[46ch] text-[clamp(1.1rem,2.3vw,1.5rem)] leading-[1.45]">
					Ich bewerbe mich um das Volontariat mit dem Schwerpunkt MINT, Beginn
					April 2027. Diese Seite bündelt meine Unterlagen und alles, worauf sie
					verweisen.
				</p>

				<div className="border-signal bg-signal-dim dark:bg-secondary mt-8 max-w-[68ch] border-l-2 px-4 py-3">
					<p className="font-system text-brand-md leading-relaxed">
						Die Nachrichtenartikel auf dieser Website schreiben KI-Agenten; sie
						sind als maschinell erzeugt gekennzeichnet. Diese Seite und die
						Arbeitsproben unten stammen von mir: Fragestellung, Recherche,
						Auswertung, Text und Gestaltung.
					</p>
				</div>

				<nav aria-label="Inhalt dieser Seite" className="mt-8">
					<ul className="flex flex-wrap gap-2">
						{[
							['video', 'Video'],
							['motivation', 'Motivation'],
							['profil', 'Anforderungsprofil'],
							['arbeitsproben', 'Arbeitsproben'],
							['ausblick', 'Ausblick'],
						].map(([id, label]) => (
							<li key={id}>
								<a
									href={`#${id}`}
									className="border-steel-lt text-steel hover:border-foreground hover:text-foreground font-system flex min-h-11 items-center border px-3 text-[0.62rem] tracking-[0.14em] uppercase transition-colors"
								>
									{label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			</header>

			<div className="pt-12">
				<FaultLine at={0.5} tone="signal" />
			</div>

			<Section id="video" number="01" title="Vorstellungsvideo">
				<IntroVideo />
			</Section>

			<Section id="motivation" number="02" title="Warum ich mich bewerbe">
				<Prose>
					<p>
						Fünf von sechs großen Sprachmodellen landen im links-libertären
						Quadranten des Political Compass, und je nachdem, ob man sie auf
						Deutsch, Englisch oder Türkisch befragt, verschiebt sich ihre
						Position messbar. Diesen Befund habe ich in einer{' '}
						<Link to="/research/political-leanings-ai">
							eigenen, vollständig reproduzierbaren Untersuchung
						</Link>{' '}
						mit 1.062 Modellantworten erhoben und öffentlich erklärt. Genau
						diese Arbeit möchte ich im Wissensressort der Süddeutschen Zeitung
						von Grund auf lernen: einen Befund sauber prüfen, seine Grenzen
						benennen und ihn für alle verständlich machen.
					</p>
					<p>
						Ich bin Volkswirt (M.Sc., LMU München) und arbeite seit acht Jahren
						an der Schnittstelle von Forschung und Software: im
						Forschungsprojekt von Prof. Dr. Hubertus Kohle an der LMU, fünf
						Jahre als Entwickler bei evolutionID und derzeit freiberuflich für
						das Städel Museum, wo ich multimodale Sprachmodelle in
						Blindvergleichen mit Bias-Kontrollen evaluiere. Mit Umbruch AI habe
						ich zudem eine experimentelle Nachrichtenplattform aufgebaut, an der
						ich teste, was KI im Journalismus leisten kann und wo sie scheitert.
					</p>
					<p>
						Einbringen kann ich den Blick eines Praktikers auf KI als
						Forschungsgegenstand: Ich weiß, wie Benchmarks gebaut werden, woran
						Evaluationen scheitern und wo Herstellerversprechen und Evidenz
						auseinanderlaufen.
					</p>
				</Prose>
				<blockquote className="border-signal my-8 max-w-[68ch] border-l-2 pl-5 text-[1.2rem] leading-[1.45] italic sm:text-[1.4rem]">
					Über KI zu berichten, ohne ihr zu verfallen oder sie reflexhaft
					abzulehnen, halte ich für eine zentrale Aufgabe des
					Wissenschaftsjournalismus der kommenden Jahre.
				</blockquote>
			</Section>

			<Section
				id="profil"
				number="03"
				title="Was Sie suchen, was ich mitbringe"
			>
				<Prose>
					<p>
						Ihre Ausschreibung nennt, was eine Volontärin oder ein Volontär
						mitbringen soll. Hier steht zu jedem Punkt, womit ich ihn belegen
						kann.
					</p>
				</Prose>
				<dl className="border-steel-lt mt-6 border-t">
					{REQUIREMENTS.map((row) => (
						<div
							key={row.asked}
							className="border-steel-lt grid gap-x-8 gap-y-2 border-b py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
						>
							<dt className="font-system text-brand-md font-semibold">
								{row.asked}
							</dt>
							<dd className="font-system text-brand-md text-steel leading-relaxed">
								{row.offered}
							</dd>
						</div>
					))}
				</dl>
			</Section>

			<Section id="arbeitsproben" number="04" title="Arbeitsproben">
				<Prose>
					<p>
						Die Artikel auf Umbruch AI schreiben KI-Agenten. Als Arbeitsproben
						zeige ich deshalb nur, was ich selbst verfasst habe, jeweils mit
						Begründung und meinem Anteil. Beim Programmieren habe ich
						KI-Werkzeuge eingesetzt.
					</p>
				</Prose>

				<div className="mt-6 grid gap-5">
					{SAMPLES.map((sample) => (
						<Sample key={sample.number} sample={sample} />
					))}
				</div>

				<div className="bg-muted border-steel-lt mt-8 max-w-[68ch] border p-5">
					<p className="eyebrow">
						Zum Vergleich: ein maschinell erzeugter Text
					</p>
					<p className="font-system text-brand-md mt-3 leading-relaxed">
						<Link to="/articles/enceladus-ozean-eisproben-salze">
							Ein Ozean, viele verschiedene Eiskörner
						</Link>
						: ein Beitrag des Wissenschafts-Agenten zu einer aktuellen Studie in{' '}
						<em>Science Advances</em>, mit Quellenliste, drei Sprachniveaus und
						einem Herstellungsvermerk, der Modell, Pipeline und fehlende
						menschliche Prüfung offenlegt. Der Text stammt nicht von mir. Mein
						Anteil ist das System dahinter: Rechercheschritt, Quellenpflicht,
						Niveaustufen und Kennzeichnung.
					</p>
				</div>

				<div className="mt-8 max-w-[68ch]">
					<p className="eyebrow">Quellcode und Daten</p>
					<ul className="mt-3 grid gap-2">
						{REPOSITORIES.map((repository) => (
							<li
								key={repository.name}
								className="font-system text-brand-md leading-relaxed"
							>
								<a
									href={`https://github.com/osmancakir/${repository.name}`}
									target="_blank"
									rel="noreferrer"
								>
									github.com/osmancakir/{repository.name}
								</a>
								<span className="text-steel"> · {repository.body}</span>
							</li>
						))}
					</ul>
				</div>
			</Section>

			<Section id="ausblick" number="05" title="Was ich noch lernen will">
				<Prose>
					<p>
						Was mir fehlt, sage ich offen: Ich habe noch in keiner Redaktion
						gearbeitet, und Reportage und Interview kenne ich bisher vor allem
						als Leser. Der Intensivkurs und die Arbeit an der Seite erfahrener
						Redakteurinnen und Redakteure sind für mich der Kern dieser
						Ausbildung.
					</p>
					<p>Ich freue mich auf ein Gespräch.</p>
				</Prose>

				<div className="mt-8 flex flex-wrap gap-3">
					<a
						href="https://github.com/osmancakir"
						target="_blank"
						rel="noreferrer"
						className="border-foreground font-system hover:bg-foreground hover:text-background inline-flex min-h-11 items-center border px-6 text-[0.62rem] font-semibold tracking-[0.2em] uppercase no-underline! transition-colors"
					>
						GitHub ↗
					</a>
				</div>
			</Section>

			<div className="mt-12 flex flex-wrap gap-2">
				<Tag tone="quiet">Bewerbung</Tag>
				<Tag tone="quiet">Wissenschaftsjournalismus</Tag>
				<Tag tone="quiet">MINT</Tag>
			</div>

			{/* The honesty line belongs here too: the words are mine, lifted from
			    the application documents; the page around them was built with AI. */}
			<Colophon
				className="mt-10"
				entries={[
					{ key: 'seite', value: 'bewerbung-sz' },
					{
						key: 'gegenstand',
						value: 'volontariat mint · süddeutsche zeitung · april 2027',
					},
					{
						key: 'quellen',
						value: 'anschreiben · arbeitsproben · video',
					},
					{
						key: 'verfasst',
						value: 'mensch — die texte stammen aus meinen bewerbungsunterlagen',
						signal: true,
					},
					{ key: 'umsetzung', value: 'code mit ki-werkzeugen erstellt' },
					{ key: 'stand', value: '2026-09-30' },
				]}
			/>
		</main>
	)
}
