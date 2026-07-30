import { type Config } from '@react-router/dev/config'
import { sentryOnBuildEnd } from '@sentry/react-router'

const MODE = process.env.NODE_ENV

export default {
	// Defaults to true. Set to false to enable SPA for all routes.
	ssr: true,

	routeDiscovery: { mode: 'initial' },

	future: {
		unstable_optimizeDeps: true,
		// Required for @cloudflare/vite-plugin to drive the SSR environment —
		// without it the two plugins disagree about the build output directory.
		v8_viteEnvironmentApi: true,
	},

	buildEnd: async ({ viteConfig, reactRouterConfig, buildManifest }) => {
		if (MODE === 'production' && process.env.SENTRY_AUTH_TOKEN) {
			await sentryOnBuildEnd({
				viteConfig,
				reactRouterConfig,
				buildManifest,
			})
		}
	},
} satisfies Config
