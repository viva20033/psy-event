/**
 * Disabled modules — architecturally reserved, not implemented in v1.
 * Enable flags when modules are ready; routes stay unregistered while false.
 */
export const featureFlags = {
  chat: false,
  gallery: false,
  workshops: false,
  networking: false,
  push: false,
  polls: false,
  materials: false,
  notes: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
