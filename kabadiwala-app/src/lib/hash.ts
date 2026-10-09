import { sha256 } from 'js-sha256';

/**
 * Generates a tamper-evident 6-digit code based on lot details.
 * This proves to the recycler that the weight and material were not altered
 * between the time the collector saved the lot and the handover.
 */
export function generateHandoverCode(lotId: string, material: string, weight: string, estimate: number): string {
  // Create a plain-text payload of the critical facts
  const payload = `id=${lotId}|mat=${material}|kg=${weight}|est=${estimate}`;
  
  // Hash it
  const hash = sha256(payload);
  
  // Take the first 12 hex characters and parse as an integer, then modulo to get 6 digits
  const shortHash = parseInt(hash.substring(0, 12), 16);
  const sixDigitCode = (shortHash % 1000000).toString().padStart(6, '0');
  
  return sixDigitCode;
}
