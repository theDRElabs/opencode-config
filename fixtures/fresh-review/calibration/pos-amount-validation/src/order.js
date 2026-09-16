export async function applyDiscount(order, repository) {
  const total = order.subtotal - order.discount;
  await repository.save({ ...order, total });
  return { status: 200, total };
}
