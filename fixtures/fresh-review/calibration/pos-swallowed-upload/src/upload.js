export async function uploadFile(file, storage) {
  try {
    const url = await storage.put(file);
    return { status: 200, url };
  } catch (error) {
    return { status: 200, url: null };
  }
}
