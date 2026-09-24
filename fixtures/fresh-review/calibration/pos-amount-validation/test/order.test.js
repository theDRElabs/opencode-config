test('applies discount', async () => {
  const result = await applyDiscount(order, repository);
  assert.ok(result);
});
