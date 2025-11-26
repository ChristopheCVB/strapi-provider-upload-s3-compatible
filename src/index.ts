import type { ReadStream } from 'node:fs'

import z from 'zod'
import { joinURL } from 'ufo'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import packageJson from '../package.json'

const providerOptionsSchema = z.object({
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  endPoint: z.url(),
  region: z.string().min(1),
  bucket: z.string().min(1),
  forcePathStyle: z.boolean().optional(),
  isPrivate: z.boolean(),
  folder: z.string().min(1),
})

const uploadOptionsSchema = z.object({
  cacheControl: z.string().optional(),
}).optional()

const deleteOptionsSchema = z.object({}).optional()

const getSignedUrlOptionsSchema = z.object({
  expiresIn: z.number().optional(),
}).optional()

const actionOptionsSchema = z.object({
  upload: uploadOptionsSchema,
  uploadStream: uploadOptionsSchema,
  delete: deleteOptionsSchema,
  getSignedUrl: getSignedUrlOptionsSchema,
}).partial().optional()

const _configSchema = z.object({
  provider: z.literal(packageJson.name),
  providerOptions: providerOptionsSchema,
  actionOptions: actionOptionsSchema,
})

export type Config = z.infer<typeof _configSchema>

export interface StrapiFile {
  name: string;
  alternativeText?: string;
  caption?: string;
  width?: number;
  height?: number;
  formats?: Record<string, unknown>;
  hash: string;
  ext?: string;
  mime: string;
  size: number;
  sizeInBytes: number;
  url: string;
  previewUrl?: string;
  path?: string;
  provider?: string;
  provider_metadata?: Record<string, unknown>;
  stream?: ReadStream;
  buffer?: Buffer;
}

function init(providerOptions: unknown) {
  const parsedProviderOptions = providerOptionsSchema.parse(providerOptions)
  const s3 = new S3Client({
    endpoint: parsedProviderOptions.endPoint,
    region: parsedProviderOptions.region,
    credentials: {
      accessKeyId: parsedProviderOptions.accessKey,
      secretAccessKey: parsedProviderOptions.secretKey,
    },
    forcePathStyle: parsedProviderOptions.forcePathStyle,
  })

  const getFileKey = (file: StrapiFile) => {
    return joinURL(parsedProviderOptions.folder, file.path || '', `${file.hash}${file.ext}`)
  }

  return {
    async upload(file: StrapiFile, actionOptions: unknown = undefined) {
      const parsedActionOptions = uploadOptionsSchema.parse(actionOptions)
      const fileKey = getFileKey(file)
      const command = new PutObjectCommand({
        Bucket: parsedProviderOptions.bucket,
        Key: fileKey,
        Body: file.stream || file.buffer,
        ContentType: file.mime,
        CacheControl: parsedActionOptions?.cacheControl,
      })
      await s3.send(command)
      file.url = joinURL(parsedProviderOptions.endPoint, parsedProviderOptions.bucket, fileKey)
    },

    uploadStream(file: StrapiFile, actionOptions: unknown = undefined) {
      return this.upload(file, actionOptions)
    },

    async delete(file: StrapiFile, _actionOptions: unknown = undefined) {
      const fileKey = getFileKey(file)
      const command = new DeleteObjectCommand({ Bucket: parsedProviderOptions.bucket, Key: fileKey })
      await s3.send(command)
    },
      
    // checkFileSize(file: StrapiFile, { sizeLimit }: { sizeLimit: number }) {
    //   // (optional)
    //   // implement your own file size limit logic
    // },

    async getSignedUrl(file: StrapiFile, actionOptions: unknown = undefined): Promise<{ url: string }> {
      const parsedActionOptions = getSignedUrlOptionsSchema.parse(actionOptions)
      if (!file.url || !file.url.startsWith(parsedProviderOptions.endPoint)) {
        return { url: file.url }
      }
      const fileURL = new URL(file.url)
      if (fileURL.searchParams.has('X-Amz-Date') && fileURL.searchParams.has('X-Amz-Expires')) {
        const xAmzExpires = parseInt(fileURL.searchParams.get('X-Amz-Expires') || '0')
        const xAmzDate = new Date(fileURL.searchParams.get('X-Amz-Date') || '')
        const expiresAtTime = xAmzDate.getTime() + xAmzExpires * 1000
        if (expiresAtTime - 60 * 1000 > Date.now()) { // one minute before expiration
          // file is not expired
          return { url: file.url }
        }
      }
      const fileKey = getFileKey(file)
      const command = new GetObjectCommand({ Bucket: parsedProviderOptions.bucket, Key: fileKey })
      const url = await getSignedUrl(s3, command, { expiresIn: parsedActionOptions?.expiresIn })
      return { url }
    },

    isPrivate() {
      return parsedProviderOptions.isPrivate
    },
  }
}

export {
  init,
}
