import type { InjectionKey } from "vue";
import { noForge, type Forge } from "~/utils/forge";

const KEY: InjectionKey<Readonly<Ref<Forge>>> = Symbol("forge");

/** Make the active loop's forge (web root, repo, milestones) available below. */
export function provideForge(forge: Readonly<Ref<Forge>>): void {
  provide(KEY, forge);
}

/** The forge the surrounding loop links to; links are omitted without one. */
export function useForge(): Readonly<Ref<Forge>> {
  return inject(KEY, ref(noForge));
}
