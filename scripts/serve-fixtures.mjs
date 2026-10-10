import { resolve } from 'node:path';
import { csp, projectRoot, startServer } from './serve.mjs';
await startServer(resolve(projectRoot, 'test'), 5189, { policy: `${csp.replace("frame-ancestors 'none'", "frame-ancestors 'self'")}; frame-src 'self'` });
