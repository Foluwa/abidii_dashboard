import { webcrypto } from 'crypto';

import { findExistingMediaForFile, linkTargetFor, sha256OfFile } from '@/lib/mediaLibraryApi';

const mockGet = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args), post: jest.fn() },
}));

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function blobOf(text: string): Blob {
  const bytes = Uint8Array.from(Buffer.from(text, 'utf8'));
  // jsdom's Blob lacks arrayBuffer(); give the hasher what a browser File has.
  return { arrayBuffer: async () => bytes.buffer.slice(0) } as unknown as Blob;
}

describe('mediaLibraryApi', () => {
  const originalCrypto = globalThis.crypto;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });

  beforeEach(() => mockGet.mockReset());

  it('hashes files with Web Crypto SHA-256', async () => {
    await expect(sha256OfFile(blobOf('abc'))).resolves.toBe(ABC_SHA256);
  });

  it('looks up the library by content hash', async () => {
    const asset = { id: 'asset-1', storage_key: 'media/audio/x.mp3', registered: true };
    mockGet.mockResolvedValue({ data: { sha256: ABC_SHA256, found: true, asset } });

    await expect(findExistingMediaForFile(blobOf('abc'))).resolves.toEqual(asset);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/media-library/lookup', { params: { sha256: ABC_SHA256 } });
  });

  it('falls back to a normal upload when the lookup fails or finds nothing', async () => {
    mockGet.mockResolvedValueOnce({ data: { sha256: ABC_SHA256, found: false, asset: null } });
    await expect(findExistingMediaForFile(blobOf('abc'))).resolves.toBeNull();
    mockGet.mockRejectedValueOnce(new Error('404'));
    await expect(findExistingMediaForFile(blobOf('abc'))).resolves.toBeNull();
  });

  it('links registered assets by id and legacy objects by key', () => {
    expect(linkTargetFor({ id: 'a1', storage_key: 'k' } as any)).toEqual({ media_asset_id: 'a1' });
    expect(linkTargetFor({ storage_key: 'images/lion.png' } as any)).toEqual({ storage_key: 'images/lion.png' });
  });
});
