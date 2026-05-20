import { handle } from 'hono/cloudflare-pages';
// @ts-expect-error — TS path resolution to monorepo package
import app from '../../packages/axoview-worker/src/app';

export const onRequest = handle(app);
