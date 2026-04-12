/** Round a number to 2 decimal places for currency display */
export function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}
