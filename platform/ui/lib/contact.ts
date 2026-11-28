// The address customers write to about billing, refunds, Enterprise plans and
// legal questions. Used by the pricing page, its plan buttons and the refund
// policy, so changing it here changes it everywhere a buyer sees it.
export const CONTACT_EMAIL = "legal@lelu-ai.com";

export function contactMailto(subject: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
