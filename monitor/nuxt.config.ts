// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  // A live dashboard fed entirely over WebSocket: nothing to server-render.
  ssr: false,
  modules: ["@nuxt/eslint", "@nuxt/ui", "@comark/nuxt"],
  // The log was always dark; keep it that way rather than following the OS.
  colorMode: { preference: "dark", fallback: "dark" },
  eslint: { config: { stylistic: false } },
  css: ["~/assets/main.css"],
  app: {
    head: {
      title: "claudjar loops",
      htmlAttrs: { lang: "en" },
      link: [{ rel: "icon", type: "image/svg+xml", href: "/icon.svg" }],
    },
  },
  runtimeConfig: {
    // NUXT_AGENT_TOKEN: when set, loop instances must present it in `hello`.
    agentToken: "",
    // NUXT_DATA_DIR: where the loops' progress and open questions are persisted.
    dataDir: ".data",
  },
  nitro: { experimental: { websocket: true } },
});
