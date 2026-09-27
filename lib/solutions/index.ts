import type { Solution } from "./types";
import { pizzeria } from "./pizzeria";
import { restaurant } from "./restaurant";
import { cafe } from "./cafe";
import { deliveryCommissions } from "./delivery-commissions";

export type { Solution, Block } from "./types";

export const SOLUTIONS: Solution[] = [
  restaurant,
  pizzeria,
  cafe,
  deliveryCommissions,
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
