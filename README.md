# Strapi Provider Upload MinIO CE

A Strapi upload provider for MinIO Community Edition. This provider enables Strapi to store and serve media files using MinIO, an S3-compatible object storage server.

## Features

- ✅ Upload files to MinIO
- ✅ Upload file streams
- ✅ Delete files from MinIO
- ✅ Generate signed URLs for private files
- ✅ Support for both public and private buckets
- ✅ TypeScript support
- ✅ Full type safety with Zod validation
- ✅ Configurable cache control headers

## Configuration

To use this provider in your Strapi application, configure it in your `config/plugins.ts` file:

```typescript
import type { Config as MinioConfig } from 'strapi-provider-upload-minio-ce'

export default {
  upload: {
    config: {
      provider: 'strapi-provider-upload-minio-ce',
      providerOptions: {
        accessKey: process.env.MINIO_ACCESS_KEY,      // your MinIO access key
        secretKey: process.env.MINIO_SECRET_KEY,      // your MinIO secret key
        bucket: process.env.MINIO_BUCKET,             // your MinIO bucket name
        endPoint: process.env.MINIO_ENDPOINT,         // your MinIO server endpoint (without protocol, e.g., 'api.minio.example.com')
        isPrivate: process.env.MINIO_IS_PRIVATE === 'true', // true for private, false for public
        folder: process.env.MINIO_FOLDER || 'strapi', // folder prefix in bucket
      },
      actionOptions: {
        upload: {
          cacheControl: 'public, max-age=31536000, immutable', // optional
        },
        uploadStream: {
          cacheControl: 'public, max-age=31536000, immutable', // optional
        },
        getSignedUrl: {
          expiresIn: 3600, // optional
        },
      },
    } satisfies MinioConfig,
  },
}
```

## Usage

Once configured, Strapi will automatically use this provider for all file uploads. Files will be stored in MinIO at the path:

```
{bucket}/{folder}/{file.path}_{file.hash}{file.ext}
```

### Private Files

When `isPrivate` is set to `true`, the provider will generate signed URLs for file access. Signed URLs expire after the configured `expiresIn` period.

### Public Files

When `isPrivate` is set to `false`, files are accessible via direct URLs without authentication.

## Development

### Scripts

- `pnpm build` - Compile TypeScript to JavaScript in the `dist/` directory
- `pnpm dev` - Watch mode for development
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint errors
- `pnpm typecheck` - Type check without emitting files

### Requirements

- Node.js >= 24.11.1
- pnpm 10.23.0
or
- Volta.sh

## Dependencies

- `@aws-sdk/client-s3` - AWS SDK for S3-compatible operations
- `@aws-sdk/s3-request-presigner` - Generate presigned URLs
- `zod` - Runtime type validation

## License

MIT

