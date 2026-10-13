import { sha256 } from 'js-sha256';

/**
 * Deterministically serializes core transaction fields into a canonical string.
 * Uses strict key=value pairing with alphabetical key ordering to ensure consistency.
 */
export function serializeLotPayload(lotId: string, material: string, weight: string | number, estimate: number): string {
  const normWeight = typeof weight === 'number' ? weight.toFixed(2) : parseFloat(weight).toFixed(2);
  const normEstimate = Math.round(estimate);
  return `est=${normEstimate}|id=${lotId.trim()}|kg=${normWeight}|mat=${material.trim().toLowerCase()}`;
}

/**
 * Computes a full 256-bit (64 hex characters) cryptographic hash for a lot.
 * Stores the full SHA-256 digest for audit and verification.
 */
export function generateFullSha256(lotId: string, material: string, weight: string | number, estimate: number): string {
  const payload = serializeLotPayload(lotId, material, weight, estimate);
  return sha256(payload);
}

/**
 * Generates a human-friendly 6-digit checksum for physical receipts / Parchi verification.
 * 
 * SECURITY BOUNDARY NOTE:
 * This 6-digit code is derived deterministically by truncating the SHA-256 digest.
 * It serves as an easy-to-read parity check for informal collectors with limited literacy.
 * It is NOT a substitute for digital signatures (as it does not use public/private key pairs)
 * and does not provide blockchain immutability.
 */
export function generateHandoverCode(lotId: string, material: string, weight: string | number, estimate: number): string {
  const hash = generateFullSha256(lotId, material, weight, estimate);
  const shortHash = parseInt(hash.substring(0, 12), 16);
  return (shortHash % 1000000).toString().padStart(6, '0');
}

/**
 * Verifies whether provided lot details match an expected 6-digit code or full hash.
 * Detects any tampering or post-intake modification to material, weight, or estimate.
 */
export function verifyLotIntegrity(params: {
  lotId: string;
  material: string;
  weight: string | number;
  estimate: number;
  expectedCode?: string;
  expectedHash?: string;
}): { isValid: boolean; recomputedCode: string; recomputedHash: string } {
  const recomputedHash = generateFullSha256(params.lotId, params.material, params.weight, params.estimate);
  const shortHash = parseInt(recomputedHash.substring(0, 12), 16);
  const recomputedCode = (shortHash % 1000000).toString().padStart(6, '0');

  let isValid = true;
  if (params.expectedCode && params.expectedCode.trim() !== recomputedCode) {
    isValid = false;
  }
  if (params.expectedHash && params.expectedHash.trim().toLowerCase() !== recomputedHash.toLowerCase()) {
    isValid = false;
  }

  return { isValid, recomputedCode, recomputedHash };
}
