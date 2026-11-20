/** Test helpers for the packed attribute layers of the admin analysis. */
import type { LayerToggles } from '../../../../shared/types';
import { LAYER_OFFSET, type AdditiveLayer, type LayeredBuild } from '../attributeLayers';

/** All layers on: the values the simulator fought with (stance included). */
export const ALL_LAYERS_ON: Readonly<LayerToggles> = {
  tuning: true,
  weapons: true,
  refinements: true,
  loadout: true,
  stance: true,
};

/** One additive layer's value for attribute index `k`. */
export function layerValue(build: LayeredBuild, layer: AdditiveLayer, k: number): number {
  return build.data[LAYER_OFFSET[layer] + k];
}
