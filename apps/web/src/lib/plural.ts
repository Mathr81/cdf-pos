/** « 1 commande », « 2 commandes » ; en français 0 et 1 sont au singulier. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${Math.abs(n) > 1 ? many : one}`;
}
