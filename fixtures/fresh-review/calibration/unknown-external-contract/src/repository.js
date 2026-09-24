// Thin wrapper over the storage client. The accepted options and their
// semantics are defined by the client library, which is pinned in
// package.json but not vendored into this bundle.
export async function update(body, options) {
  return client.update(body, options);
}
