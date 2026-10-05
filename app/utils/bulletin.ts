import { z } from 'zod'

const LevelTextSchema = z
	.object({
		easy: z.string().nullish(),
		medium: z.string().nullish(),
		advanced: z.string().nullish(),
	})
	.transform((value) => ({
		easy: value.easy ?? undefined,
		medium: value.medium ?? undefined,
		advanced: value.advanced ?? undefined,
	}))

export const BulletinSchema = z.object({
	_id: z.string(),
	date: z.string(),
	dateLabel: z.string().nullable(),
	durationSec: z.number().nullable(),
	videoUrl: z.string().url(),
	posterUrl: z.string().url().nullable(),
	transcript: z.string().nullable(),
	stories: z
		.array(z.object({ slug: z.string(), title: LevelTextSchema }))
		.nullable()
		.transform((stories) => stories ?? []),
})

export type Bulletin = z.infer<typeof BulletinSchema>
