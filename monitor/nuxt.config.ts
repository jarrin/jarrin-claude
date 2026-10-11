// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  // A live dashboard fed entirely over WebSocket: nothing to server-render.
  ssr: false,
  modules: ["@nuxt/eslint", "@nuxt/ui", "@comark/nuxt", "nuxt-auth-utils"],
  // The log was always dark; keep it that way rather than following the OS.
  colorMode: { preference: "dark", fallback: "dark" },
  eslint: { config: { stylistic: false } },
  css: ["~/assets/main.css"],
  app: {
    head: {
      title: "claudjar",
      htmlAttrs: { lang: "en" },
      link: [{ rel: "icon", type: "image/svg+xml", href: "/icon.svg" }],
    },
  },
  runtimeConfig: {
    // NUXT_AGENT_TOKEN: loops, services and live-log followers must present it.
    // Mandatory: left empty, every one of them is rejected.
    agentToken: "",
    // NUXT_WEBHOOK_SECRET: the secret Gitea signs webhook deliveries with.
    // Left empty, /api/webhook/gitea refuses every delivery.
    webhookSecret: "",
    // NUXT_OIDC_*: the browser login against the homeserver auth app. The
    // callback is fixed at /auth/callback, the redirect_uri registered there.
    oidc: {
      issuer: "",
      clientId: "",
      clientSecret: "",
      redirectUri: "",
    },
    // NUXT_DATA_DIR: where the loops' progress and open questions are persisted.
    dataDir: ".data",
  },
  nitro: { experimental: { websocket: true } },
});
