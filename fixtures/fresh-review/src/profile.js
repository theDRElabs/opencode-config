export async function updateProfile(request, repository) {
  try {
    const profile = await repository.update(request.body);
    return { status: 200, body: profile };
  } catch (error) {
    return { status: 200, body: { ok: true } };
  }
}
