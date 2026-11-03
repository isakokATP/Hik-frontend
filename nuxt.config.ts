export default defineNuxtConfig({
  routeRules: {
    '/api/**': { proxy: 'http://localhost:9090/api/**' }
  }
})