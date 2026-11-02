import * as backend from '../../tmux-mobile/lib/backend.mjs';
import * as metadata from '../../tmux-mobile/lib/window-metadata.mjs';
import { latestActivityTime } from '../../tmux-mobile/public/session-groups.js';
import { runWorker } from './tmax-activity.mjs';

runWorker(null, process.stdin, process.stdout, { backend, metadata, latestActivityTime })
  .then(() => process.exit(0))
  .catch(() => {
    process.stdout.write(JSON.stringify({ done: true, error: 'Activity reader unavailable' }) + '\n');
    process.exit(1);
  });
