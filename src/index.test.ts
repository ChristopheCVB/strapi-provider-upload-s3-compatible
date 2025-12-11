import type { StrapiFile } from './index'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { init, type Config } from './index'

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: vi.fn(function(this: any) {
      this.send = vi.fn().mockResolvedValue({})
    }),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}))

describe('strapi-provider-upload-s3', () => {
  const mockProviderOptions: Config['providerOptions'] = {
    accessKey: 'test-access-key',
    secretKey: 'test-secret-key',
    endPoint: 'https://api.s3.example.com',
    region: 'us-east-1',
    bucket: 'test-bucket',
    forcePathStyle: true,
    isPrivate: false,
    folder: 'uploads',
  }

  const mockFile: StrapiFile = {
    name: 'test-file.jpg',
    hash: 'test-hash-123',
    ext: '.jpg',
    mime: 'image/jpeg',
    size: 1024,
    sizeInBytes: 1024,
    url: '',
    buffer: Buffer.from('test-data'),
  }

  let mockS3Send: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockS3Send = vi.fn().mockResolvedValue({});
    (S3Client as any).mockImplementation(function(this: any) {
      this.send = mockS3Send
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('init', () => {
    it('should initialize provider with valid options', () => {
      const provider = init(mockProviderOptions)

      expect(provider).toBeDefined()
      expect(provider.upload).toBeDefined()
      expect(provider.uploadStream).toBeDefined()
      expect(provider.delete).toBeDefined()
      expect(provider.getSignedUrl).toBeDefined()
      expect(provider.isPrivate).toBeDefined()
      expect(S3Client).toHaveBeenCalledWith({
        endpoint: mockProviderOptions.endPoint,
        region: mockProviderOptions.region,
        credentials: {
          accessKeyId: mockProviderOptions.accessKey,
          secretAccessKey: mockProviderOptions.secretKey,
        },
        forcePathStyle: mockProviderOptions.forcePathStyle,
      })
    })

    it('should throw error with invalid provider options - missing accessKey', () => {
      const invalidOptions = { ...mockProviderOptions, accessKey: '' }
      expect(() => init(invalidOptions)).toThrow()
    })

    it('should throw error with invalid provider options - missing secretKey', () => {
      const invalidOptions = { ...mockProviderOptions, secretKey: '' }
      expect(() => init(invalidOptions)).toThrow()
    })

    it('should throw error with invalid provider options - invalid endPoint', () => {
      const invalidOptions = { ...mockProviderOptions, endPoint: 'not-a-url' }
      expect(() => init(invalidOptions)).toThrow()
    })

    it('should throw error with invalid provider options - missing region', () => {
      const invalidOptions = { ...mockProviderOptions, region: '' }
      expect(() => init(invalidOptions)).toThrow()
    })

    it('should throw error with invalid provider options - missing bucket', () => {
      const invalidOptions = { ...mockProviderOptions, bucket: '' }
      expect(() => init(invalidOptions)).toThrow()
    })

    it('should throw error with invalid provider options - missing folder', () => {
      const invalidOptions = { ...mockProviderOptions, folder: '' }
      expect(() => init(invalidOptions)).toThrow()
    })
  })

  describe('upload', () => {
    it('should upload file with buffer', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }

      await provider.upload(file)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/test-hash-123.jpg',
        Body: file.buffer,
        ContentType: file.mime,
        CacheControl: undefined,
      })
      expect(mockS3Send).toHaveBeenCalledTimes(1)
      expect(file.url).toBe('https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg')
    })

    it('should upload file with stream', async () => {
      const provider = init(mockProviderOptions)
      const stream = Readable.from(['test-data'])
      const file = { ...mockFile, stream: stream as any, buffer: undefined }

      await provider.upload(file)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/test-hash-123.jpg',
        Body: stream,
        ContentType: file.mime,
        CacheControl: undefined,
      })
      expect(mockS3Send).toHaveBeenCalledTimes(1)
      expect(file.url).toBe('https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg')
    })

    it('should upload file with custom path', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile, path: 'subfolder' }

      await provider.upload(file)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/subfolder/test-hash-123.jpg',
        Body: file.buffer,
        ContentType: file.mime,
        CacheControl: undefined,
      })
      expect(mockS3Send).toHaveBeenCalledTimes(1)
      expect(file.url).toBe('https://api.s3.example.com/test-bucket/uploads/subfolder/test-hash-123.jpg')
    })

    it('should upload file with cache control', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }
      const actionOptions = { cacheControl: 'max-age=3600' }

      await provider.upload(file, actionOptions)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/test-hash-123.jpg',
        Body: file.buffer,
        ContentType: file.mime,
        CacheControl: 'max-age=3600',
      })
      expect(mockS3Send).toHaveBeenCalledTimes(1)
    })

    it('should handle upload errors', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }
      mockS3Send.mockRejectedValueOnce(new Error('Upload failed'))

      await expect(provider.upload(file)).rejects.toThrow('Upload failed')
    })
  })

  describe('uploadStream', () => {
    it('should call upload method', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }
      const uploadSpy = vi.spyOn(provider, 'upload')

      await provider.uploadStream(file)

      expect(uploadSpy).toHaveBeenCalledWith(file, undefined)
    })

    it('should pass action options to upload', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }
      const actionOptions = { cacheControl: 'no-cache' }
      const uploadSpy = vi.spyOn(provider, 'upload')

      await provider.uploadStream(file, actionOptions)

      expect(uploadSpy).toHaveBeenCalledWith(file, actionOptions)
    })
  })

  describe('delete', () => {
    it('should delete file', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }

      await provider.delete(file)

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/test-hash-123.jpg',
      })
      expect(mockS3Send).toHaveBeenCalledTimes(1)
    })

    it('should delete file with custom path', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile, path: 'subfolder/nested' }

      await provider.delete(file)

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/subfolder/nested/test-hash-123.jpg',
      })
      expect(mockS3Send).toHaveBeenCalledTimes(1)
    })

    it('should handle delete errors', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }
      mockS3Send.mockRejectedValueOnce(new Error('Delete failed'))

      await expect(provider.delete(file)).rejects.toThrow('Delete failed')
    })
  })

  describe('getSignedUrl', () => {
    it('should return existing url if not from endPoint', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile, url: 'https://other-domain.com/file.jpg' }

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe('https://other-domain.com/file.jpg')
      expect(getSignedUrl).not.toHaveBeenCalled()
    })

    it('should return existing url if empty', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile, url: '' }

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe('')
      expect(getSignedUrl).not.toHaveBeenCalled()
    })

    it('should generate signed url for file from endPoint', async () => {
      const provider = init(mockProviderOptions)
      const file = {
        ...mockFile,
        url: 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg',
      }
      const signedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=abc123';

      (getSignedUrl as any).mockResolvedValueOnce(signedUrl)

      const result = await provider.getSignedUrl(file)

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockProviderOptions.bucket,
        Key: 'uploads/test-hash-123.jpg',
      })
      expect(getSignedUrl).toHaveBeenCalled()
      expect(result.url).toBe(signedUrl)
    })

    it('should generate signed url with custom expiresIn', async () => {
      const provider = init(mockProviderOptions)
      const file = {
        ...mockFile,
        url: 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg',
      }
      const signedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=abc123'
      const actionOptions = { expiresIn: 7200 };

      (getSignedUrl as any).mockResolvedValueOnce(signedUrl)

      const result = await provider.getSignedUrl(file, actionOptions)

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 7200 },
      )
      expect(result.url).toBe(signedUrl)
    })

    it('should return existing url if already signed and not expired', async () => {
      const provider = init(mockProviderOptions)
      const now = new Date().toISOString()
      const expiresIn = 24 * 60 * 60 // 24 hours
      const file = {
        ...mockFile,
        url: `https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Date=${now}&X-Amz-Expires=${expiresIn}`,
      }

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe(file.url)
      expect(getSignedUrl).not.toHaveBeenCalled()
    })

    it('should handle getSignedUrl errors', async () => {
      const provider = init(mockProviderOptions)
      const file = {
        ...mockFile,
        url: 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg',
      };

      (getSignedUrl as any).mockRejectedValueOnce(new Error('Signing failed'))

      await expect(provider.getSignedUrl(file)).rejects.toThrow('Signing failed')
    })

    it('should generate new signed url if signed url is expired', async () => {
      const provider = init(mockProviderOptions)
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago
      const expiresIn = 1800 // 30 minutes
      const file = {
        ...mockFile,
        url: `https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Date=${pastDate}&X-Amz-Expires=${expiresIn}`,
      }
      const newSignedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=new123';

      (getSignedUrl as any).mockResolvedValueOnce(newSignedUrl)

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe(newSignedUrl)
      expect(getSignedUrl).toHaveBeenCalled()
    })

    it('should handle URL with missing X-Amz-Expires parameter', async () => {
      const provider = init(mockProviderOptions)
      const now = new Date().toISOString()
      const file = {
        ...mockFile,
        url: `https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Date=${now}`,
      }
      const newSignedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=new456';

      (getSignedUrl as any).mockResolvedValueOnce(newSignedUrl)

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe(newSignedUrl)
      expect(getSignedUrl).toHaveBeenCalled()
    })

    it('should handle URL with missing X-Amz-Date parameter', async () => {
      const provider = init(mockProviderOptions)
      const file = {
        ...mockFile,
        url: 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Expires=3600',
      }
      const newSignedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=new789';

      (getSignedUrl as any).mockResolvedValueOnce(newSignedUrl)

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe(newSignedUrl)
      expect(getSignedUrl).toHaveBeenCalled()
    })

    it('should handle URL with invalid X-Amz-Date value', async () => {
      const provider = init(mockProviderOptions)
      const file = {
        ...mockFile,
        url: 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Date=invalid-date&X-Amz-Expires=3600',
      }
      const newSignedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=newABC';

      (getSignedUrl as any).mockResolvedValueOnce(newSignedUrl)

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe(newSignedUrl)
      expect(getSignedUrl).toHaveBeenCalled()
    })

    it('should handle URL with invalid X-Amz-Expires value', async () => {
      const provider = init(mockProviderOptions)
      const now = new Date().toISOString()
      const file = {
        ...mockFile,
        url: `https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Date=${now}&X-Amz-Expires=not-a-number`,
      }
      const newSignedUrl = 'https://api.s3.example.com/test-bucket/uploads/test-hash-123.jpg?X-Amz-Signature=newDEF';

      (getSignedUrl as any).mockResolvedValueOnce(newSignedUrl)

      const result = await provider.getSignedUrl(file)

      expect(result.url).toBe(newSignedUrl)
      expect(getSignedUrl).toHaveBeenCalled()
    })
  })

  describe('isPrivate', () => {
    it('should return false when isPrivate is false', () => {
      const provider = init(mockProviderOptions)

      expect(provider.isPrivate()).toBe(false)
    })

    // it('should thow error when isPrivate is true and storeSignedUrl is not defined', () => {
    //   expect(() => init({ ...mockProviderOptions, isPrivate: true })).toThrow()
    // })

    it('should return true when isPrivate is true', () => {
      const privateOptions: Config['providerOptions'] = { ...mockProviderOptions, isPrivate: true }
      const provider = init(privateOptions)

      expect(provider.isPrivate()).toBe(true)
    })
  })

  describe('getFileKey', () => {
    it('should generate correct file key without path', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile }

      await provider.upload(file)

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'uploads/test-hash-123.jpg',
        }),
      )
    })

    it('should generate correct file key with path', async () => {
      const provider = init(mockProviderOptions)
      const file = { ...mockFile, path: 'images/avatars' }

      await provider.upload(file)

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'uploads/images/avatars/test-hash-123.jpg',
        }),
      )
    })

    it('should generate correct file key with nested folder', async () => {
      const nestedFolderOptions = { ...mockProviderOptions, folder: 'strapi/uploads' }
      const provider = init(nestedFolderOptions)
      const file = { ...mockFile }

      await provider.upload(file)

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'strapi/uploads/test-hash-123.jpg',
        }),
      )
    })
  })
})

