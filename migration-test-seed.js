/*
 * Intent: Migration test with seed data validation (2026-10-05)
 * Verifies localStorage → IDB migration path
 */

// Seed localStorage with fake old-format data
localStorage.setItem('openai-image-webui:settings', JSON.stringify({
  apiKey: 'test-key-123',
  baseUrl: 'https://api.example.com/v1',
  model: 'gpt-image-1',
  visionModel: 'gpt-4.1-mini',
  responseFormat: 'url',
  concurrency: 3
}));

localStorage.setItem('openai-image-webui:tasks', JSON.stringify([
  {
    id: 'test-task-1',
    prompt: 'A test image',
    model: 'gpt-image-1',
    size: '1024x1024',
    responseFormat: 'url',
    status: 'success',
    createdAt: Date.now() - 1000000,
    mode: 'generate'
  },
  {
    id: 'test-task-2',
    prompt: 'Another test',
    model: 'gpt-image-1',
    size: '1024x1024',
    responseFormat: 'url',
    status: 'pending',
    createdAt: Date.now() - 500000,
    mode: 'generate'
  }
]));

localStorage.setItem('openai-image-webui:batch-prompts', 'test prompt 1\ntest prompt 2\ntest prompt 3');

console.log('✅ Seed data written to localStorage');
console.log('Settings:', localStorage.getItem('openai-image-webui:settings'));
console.log('Tasks count:', JSON.parse(localStorage.getItem('openai-image-webui:tasks') || '[]').length);
console.log('Batch prompts:', localStorage.getItem('openai-image-webui:batch-prompts'));

console.log('\n📋 Migration test steps:');
console.log('1. Reload the app');
console.log('2. Migration should run automatically');
console.log('3. Check console for "Storage migration completed successfully"');
console.log('4. Verify localStorage keys are deleted after success');
console.log('5. Open IndexedDB inspector: should see "openai-image-webui" database');
console.log('   - settings store: 1 record (key="default")');
console.log('   - tasks store: 2 records (test-task-1, test-task-2)');
console.log('   - kv store: 1 record (lastBatchPrompts)');
console.log('6. Reload again: migration should NOT run (flag present)');
