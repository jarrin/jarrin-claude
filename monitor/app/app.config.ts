export default defineAppConfig({
  ui: {
    colors: {
      primary: "orange",
      neutral: "zinc",
    },
    // Prose is themed for documentation pages; the log is dense, so tighten the
    // vertical rhythm and shrink headings to fit between log lines.
    prose: {
      p: { base: "my-1.5 leading-6" },
      ul: { base: "my-1.5" },
      ol: { base: "my-1.5" },
      li: { base: "my-0.5 leading-6" },
      hr: { base: "my-3" },
      table: { slots: { root: "my-2" } },
      pre: {
        slots: { root: "my-2", header: "py-1.5", base: "py-2 text-xs/5" },
        variants: { filename: { true: { root: "my-2" } } },
      },
      h1: { slots: { base: "mt-3 mb-1.5 text-lg" } },
      h2: { slots: { base: "mt-3 mb-1.5 text-base" } },
      h3: { slots: { base: "mt-2 mb-1 text-sm" } },
      h4: { slots: { base: "mt-2 mb-1 text-sm" } },
    },
  },
});
