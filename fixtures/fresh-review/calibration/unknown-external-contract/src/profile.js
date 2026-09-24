export async function updateProfile(request, repository) {
  const profile = await repository.update(request.body, { mode: 'patch' });
  return { status: 200, body: profile };
}
