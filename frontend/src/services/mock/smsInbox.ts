/**
 * Mock SMS inbox — dev-only visibility of SMS that the real system would send.
 * The API never returns tokens in HTTP responses (FR-A02); in mock mode the
 * token appears ONLY here, simulating the customer's handset inbox.
 */
import type { MockSms } from './db';

type Listener = (log: MockSms[]) => void;

const listeners = new Set<Listener>();
let log: MockSms[] = [];

export function setSmsLog(next: MockSms[]): void {
  log = next;
  listeners.forEach((l) => l(log));
}

export function getMockSmsLog(): MockSms[] {
  return log;
}

export function subscribeMockSms(listener: Listener): () => void {
  listeners.add(listener);
  listener(log);
  return () => listeners.delete(listener);
}

export function clearMockSms(): void {
  log = [];
  listeners.forEach((l) => l(log));
}
