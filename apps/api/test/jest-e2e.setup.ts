/** Ensure auth works in e2e when apps/api/.env is missing. */
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET =
    'e2e-test-jwt-secret-do-not-use-in-production-min-32b';
}
