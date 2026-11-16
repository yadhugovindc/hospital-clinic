// Runs before any app import: config/env.ts validates and would exit if these are missing.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-secret-test-secret-test-secret-1234';
process.env.COOKIE_SECURE = 'false';
process.env.LOG_LEVEL = 'silent';
// MONGODB_URI is injected by global-setup once mongod is listening.
