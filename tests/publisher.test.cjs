const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Publisher accepts normal repository names and rejects paths or shell characters', async () => {
  const { validName } = await import('../scripts/publish-github.mjs');
  for (const name of ['seventh-archive', 'escape_room', 'game.v2']) assert.equal(validName(name), true);
  for (const name of ['', '../secrets', 'user/repo', 'a;rm', 'a&b', '-option', 'x'.repeat(101), null]) assert.equal(validName(name), false);
});

test('Publisher refuses existing or changed repositories without the matching receipt', async () => {
  const { canResume } = await import('../scripts/publish-github.mjs');
  const repository = { id: 123, name: 'game', owner: { login: 'tester' }, private: false };
  const receipt = { format: 1, repositoryId: 123, owner: 'tester', name: 'game' };
  assert.equal(canResume(receipt, repository), true);
  assert.equal(canResume(undefined, repository), false);
  assert.equal(canResume({ ...receipt, repositoryId: 999 }, repository), false);
  assert.equal(canResume({ ...receipt, owner: 'someone-else' }, repository), false);
  assert.equal(canResume(receipt, { ...repository, private: true }), false);
});

test('Publisher uploads only reviewed files, including the workflow and lossless binary bytes', async () => {
  const { collectFiles, FILES } = await import('../scripts/publish-github.mjs');
  const files = await collectFiles();
  assert.equal(files.length, FILES.length);
  assert.equal(new Set(FILES).size, FILES.length);
  assert.ok(FILES.includes('.github/workflows/pages.yml'));
  assert.ok(!FILES.some(p => p.startsWith('.env') || p.startsWith('.git/') || p.includes('publish-state')));
  const image = files.find(f => f.path.endsWith('archive-room.webp'));
  assert.equal(image.bytes.subarray(0, 4).toString(), 'RIFF');
  assert.deepEqual(Buffer.from(image.bytes.toString('base64'), 'base64'), image.bytes);
});
