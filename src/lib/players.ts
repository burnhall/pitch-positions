import "server-only";
import { createHmac } from "node:crypto";

// Kids never give an email. Each player gets an internal login address (the reserved
// .invalid domain can never receive mail) and a password derived from their PIN, so the
// PIN itself is never stored anywhere.

export const playerEmail = (playerId: string) => `p-${playerId}@players.invalid`;

export function pinPassword(playerId: string, pin: string) {
  const pepper = process.env.PLAYER_PIN_PEPPER;
  if (!pepper) throw new Error("PLAYER_PIN_PEPPER is not set (see .env.example)");
  return createHmac("sha256", pepper).update(`${playerId}:${pin}`).digest("base64url");
}

export const PIN_LENGTH = 4;
export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** After this many wrong PINs in a row, the player is locked out for LOCK_MINUTES. */
export const MAX_PIN_FAILURES = 5;
export const LOCK_MINUTES = 15;

export const normalizeNickname = (s: string) => s.trim().replace(/\s+/g, " ");
export const normalizeJoinCode = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
