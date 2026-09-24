test('uploads a file', async () => {
  const result = await uploadFile(file, storage);
  assert.ok(result);
});
