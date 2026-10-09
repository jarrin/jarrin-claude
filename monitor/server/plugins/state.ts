/** Restore the hub at boot, and write its debounced state out on shutdown. */
export default defineNitroPlugin((nitroApp) => {
  useHub();
  nitroApp.hooks.hook("close", flushState);
});
