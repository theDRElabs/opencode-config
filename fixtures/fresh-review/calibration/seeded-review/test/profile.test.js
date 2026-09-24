test('update profile', async () => {
  const response = await updateProfile(request, repository);
  assert.ok(response);
});
