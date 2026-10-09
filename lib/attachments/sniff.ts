import "server-only";
import type { AllowedMime } from "./constants";

function matches(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

// Identifica o tipo REAL pelo conteúdo. O nome e o content-type declarados
// pelo cliente não valem nada: um .html renomeado para .jpg tem de ser recusado.
export function detectMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length < 12) return null;
  if (matches(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}