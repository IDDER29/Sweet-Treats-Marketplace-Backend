// Runs once per e2e test file, before the test file (and AppModule) is imported.
//
// - PROCESS_QUEUES=false: boot the app in enqueue-only mode, like the production
//   API. The BullMQ mail worker then doesn't run inside the test process, so it
//   can't race the app's shutdown and emit a stray "Connection is closed".
// - NODE_ENV=test: the ThrottlerModule's skipIf disables rate limiting for these
//   functional suites (which make many logins).
process.env.PROCESS_QUEUES = process.env.PROCESS_QUEUES ?? 'false';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
