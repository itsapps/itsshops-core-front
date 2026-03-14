export const BOTTLE_VOLUMES_ML = [
  100, 187, 200, 250, 375, 500, 750, 1000, 1500, 2250, 3000, 4500, 5000, 6000, 9000, 12000, 15000,
] as const

export type BottleVolumeUnit = (typeof BOTTLE_VOLUMES_ML)[number]
