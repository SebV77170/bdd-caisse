const cron = require('node-cron');
const { triggerTicketSync, getTicketSyncStatus } = require('./ticketSyncService');
const { getTicketSyncConfig, updateTicketSyncConfig } = require('./ticketSyncConfig');

let job = null;

function schedule() {
  if (job) {
    job.stop();
    job = null;
  }
  const { interval, enabled } = getTicketSyncConfig();
  if (!enabled) return;

  const safeInterval = Math.max(1, Math.round(interval || 1));
  job = cron.schedule(`*/${safeInterval} * * * *`, () => {
    const res = triggerTicketSync({ source: 'auto' });
    if (!res.started && res.reason !== 'disabled') {
      if (res.reason !== 'running') {
        console.warn('Synchronisation tickets non démarrée :', res.reason);
      }
    }
  });
}

function startTicketSyncScheduler() {
  schedule();
}

function refreshTicketSyncConfig(patch) {
  const config = updateTicketSyncConfig(patch);
  schedule();
  return config;
}

module.exports = {
  startTicketSyncScheduler,
  refreshTicketSyncConfig,
  getTicketSyncConfig,
  triggerTicketSync,
  getTicketSyncStatus
};
