import { z } from "astro/zod";

const storageKey = "fixable-museum";
const storage = localStorage;

/**
 * Schema for validating and populating defaults for local store.
 * Every property should include .default for upgrade-friendliness.
 */
export const storeSchema = z.object({
  cart: z
    .record(
      z.string(), // Key is product slug
      z.object({
        // Object includes extra fields for client-side render logic
        name: z.string().min(1),
        quantity: z.number().min(1),
        price: z.number().min(0.01),
      })
    )
    .default({}),
  favorites: z.record(z.string(), z.boolean()).default({}),
  hasDismissedCookieBanner: z.boolean().default(false),
  loggedInAt: z.string().datetime().nullable().default(null),
  registration: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }).nullable().default(null),
});
export type Store = z.infer<typeof storeSchema>;
type StoreKey = keyof Store;

const storeTarget = new EventTarget();
type StoreHandler<K extends StoreKey> = (
  value: Store[K],
  previousValue: Store[K] | undefined
) => void;

function initStore() {
  try {
    const json = storage.getItem(storageKey);
    return storeSchema.parse(json ? JSON.parse(json) : {});
  } catch (error) {
    // Reset store upon error in parsing JSON or validating schema (e.g. due to upgrades)
    storage.removeItem(storageKey);
    return storeSchema.parse({});
  }
}
const store = initStore();

/** Recalls a single client-side-stored value. */
export const recall = <K extends StoreKey>(key: K): Store[K] => store[key];

/** Persists a single client-side-stored value. */
export function persist<K extends StoreKey>(key: K, value: Store[K]) {
  const previousValue = store[key];
  store[key] = value;
  storage.setItem(storageKey, JSON.stringify(store));

  storeTarget.dispatchEvent(
    new CustomEvent(key, { detail: [value, previousValue] })
  );
}

/**
 * Registers an event handler for changes to a specific store key.
 *
 * @param key Key to handle changes for
 * @param handler Function to call upon changes
 * @param shouldRunImmediately Whether to also call the handler immediately with the current value
 */
export function onStoreChange<K extends StoreKey>(
  key: K,
  handler: StoreHandler<K>,
  shouldRunImmediately = true
) {
  storeTarget.addEventListener(
    key,
    (event: CustomEvent<[Store[K], Store[K]]>) => {
      handler(event.detail[0], event.detail[1]);
    }
  );
  if (shouldRunImmediately) handler(store[key], undefined);
}
