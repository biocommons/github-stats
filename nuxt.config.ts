// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/tailwind.css'],
  modules: ['@nuxtjs/tailwindcss'],
  app: {
    head: {
      title: 'biocommons GitHub Stats',
      meta: [
        {
          name: 'description',
          content: 'Interactive dashboard for GitHub activity across biocommons repositories.'
        }
      ]
    }
  },
  devtools: { enabled: true }
})
