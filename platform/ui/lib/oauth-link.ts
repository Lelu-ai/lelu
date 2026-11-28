// Decides what a Google/GitHub sign-in may do with a Lelu account.
//
// The rule: an email address only identifies a Lelu account when the
// provider has verified it. Before this, sign-in linked to (or created) the
// account with the provider's email even when the provider said it was
// unverified. Anyone could add someone else's address to a GitHub account
// without verifying it, click "Sign in with GitHub" and be logged in as them.
//
// Kept free of database and Next.js imports so it can be unit tested
// (scripts/oauth-link.test.mjs).

export type OAuthLinkDecision =
  /** This provider account is already linked to a Lelu user: sign in as them. */
  | { kind: "use-linked" }
  /** The provider has not verified the email: refuse the sign-in. */
  | { kind: "reject-unverified" }
  /**
   * Link the provider to the existing account with this email. When that
   * account never verified its email, whoever chose its password never proved
   * they own the address, so the password is cleared and the email is marked
   * verified by the provider's check.
   */
  | { kind: "link-existing"; clearPassword: boolean; markVerified: boolean }
  /** No account yet: create one, verified by the provider. */
  | { kind: "create" };

export function decideOAuthLink(input: {
  alreadyLinked: boolean;
  providerEmailVerified: boolean;
  existing: { emailVerified: boolean; hasPassword: boolean } | null;
}): OAuthLinkDecision {
  if (input.alreadyLinked) return { kind: "use-linked" };
  if (!input.providerEmailVerified) return { kind: "reject-unverified" };
  if (input.existing) {
    const unverified = !input.existing.emailVerified;
    return {
      kind: "link-existing",
      clearPassword: unverified && input.existing.hasPassword,
      markVerified: unverified,
    };
  }
  return { kind: "create" };
}

/** Thrown by findOrCreateOAuthUser when the provider has not verified the email. */
export const OAUTH_EMAIL_UNVERIFIED = "OAUTH_EMAIL_UNVERIFIED";
