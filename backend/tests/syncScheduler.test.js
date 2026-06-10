const fs = require('fs');
const path = require('path');

const mockSchedule = jest.fn(() => ({ stop: jest.fn() }));
const mockPost = jest.fn().mockResolvedValue({ status: 200 });

jest.mock('node-cron', () => ({ schedule: mockSchedule }));
jest.mock('axios', () => ({ post: mockPost }));

const dataDir = path.join(__dirname, '.tmp-sync-scheduler');
process.env.BDD_CAISSE_DATA_DIR = dataDir;
process.env.SYNC_SCHEDULER_CRON = '*/2 * * * * *';
process.env.SYNC_SCHEDULER_URL = 'http://127.0.0.1:3999/sync';

const {
  callSync,
  startScheduler,
  stopScheduler
} = require('../syncScheduler');

afterAll(() => {
  stopScheduler();
  delete process.env.BDD_CAISSE_DATA_DIR;
  delete process.env.SYNC_SCHEDULER_CRON;
  delete process.env.SYNC_SCHEDULER_URL;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('planifie avec la frequence controlee et peut etre arrete', () => {
  startScheduler(3001);

  expect(mockSchedule).toHaveBeenCalledWith(
    '*/2 * * * * *',
    expect.any(Function)
  );

  const scheduledJob = mockSchedule.mock.results.at(-1).value;
  stopScheduler();
  expect(scheduledJob.stop).toHaveBeenCalled();
});

test('utilise une cible locale configurable pour les tests endurance', async () => {
  await callSync();
  expect(mockPost).toHaveBeenCalledWith('http://127.0.0.1:3999/sync');
});
