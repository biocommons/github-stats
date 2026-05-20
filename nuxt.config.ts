// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  experimental: {
    viteEnvironmentApi: true
  },
  css: ['~/assets/css/tailwind.css'],
  modules: ['@nuxtjs/tailwindcss'],
  runtimeConfig: {
    public: {
      dataBase: 'https://raw.githubusercontent.com/biocommons/github-stats/refs/heads/gh-pages/data',
    },
  },
  $development: {
    runtimeConfig: {
      public: {
        dataBase: '/data',
      },
    },
    nitro: {
      publicAssets: [{ dir: new URL('./data', import.meta.url).pathname, baseURL: '/data' }],
    },
  },
  app: {
    head: {
      title: 'biocommons GitHub Stats',
      meta: [
        {
          name: 'description',
          content: 'Interactive dashboard for GitHub activity across biocommons repositories.'
        }
      ],
      script: [
        {
          // Set dark class before first paint to prevent FOUC
          innerHTML: `(function(){var s=localStorage.getItem('color-mode');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d))document.documentElement.classList.add('dark');})()`,
          type: 'text/javascript',
        }
      ]
    }
  },
  devtools: { enabled: true },
})
