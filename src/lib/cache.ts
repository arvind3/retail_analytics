import { get, set } from 'idb-keyval';

const memoryCache = new Map<string, Uint8Array>();

const supportsIdb = () => typeof indexedDB !== 'undefined';

export const getCachedBuffer = async (key: string) => {
  const inMemory = memoryCache.get(key);
  if (inMemory) {
    return inMemory;
  }
  if (supportsIdb()) {
    const fromIdb = await get<Uint8Array>(key);
    if (fromIdb) {
      memoryCache.set(key, fromIdb);
      return fromIdb;
    }
  }
  return undefined;
};

export const setCachedBuffer = async (key: string, value: Uint8Array) => {
  memoryCache.set(key, value);
  if (supportsIdb()) {
    await set(key, value);
  }
};

export const fetchWithProgress = async (
  url: string,
  onProgress?: (loaded: number, total?: number) => void,
) => {
  const cached = await getCachedBuffer(url);
  if (cached) {
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0) || undefined;

  if (!response.body || !onProgress) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    await setCachedBuffer(url, buffer);
    if (onProgress) {
      onProgress(buffer.byteLength, contentLength);
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let done = false;

  while (!done) {
    const next = await reader.read();
    done = next.done;
    const { value } = next;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(received, contentLength);
    }
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  await setCachedBuffer(url, buffer);
  return buffer;
};
