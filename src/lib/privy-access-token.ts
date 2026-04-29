export async function waitForPrivyAccessToken(
  getAccessToken: () => Promise<string | null>,
  options: { attempts?: number; delayMs?: number } = {},
) {
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 350;

  for (let index = 0; index < attempts; index += 1) {
    const token = await getAccessToken();

    if (token) {
      return token;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}
