const { Storage } = require('@google-cloud/storage');
// Lazily initialize Storage and bucket so requiring this module doesn't throw when
// GCS_BUCKET_NAME is not configured. This allows the app (routes/controllers)
// to load in environments where GCS is optional or not yet configured.

let storageClient = null;
let bucket = null;

function getBucket() {
  if (bucket) return bucket;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return null; // don't throw here — let callers decide

  storageClient = new Storage({ projectId: process.env.GCP_PROJECT_ID, keyFilename: process.env.GCP_KEYFILE_PATH });
  bucket = storageClient.bucket(bucketName);
  return bucket;
}

/**
 * Returns true if GCS is configured (so uploads are possible).
 */
exports.isGcsEnabled = () => !!process.env.GCS_BUCKET_NAME;

exports.uploadBuffer = async (buffer, destinationPath, contentType = 'application/pdf') => {
  const bk = getBucket();
  if (!bk) {
    // Provide a clear runtime error; requiring the module will no longer throw.
    throw new Error('GCS_BUCKET_NAME is not set. Set the GCS_BUCKET_NAME environment variable to use Cloud Storage uploadBuffer.');
  }

  const file = bk.file(destinationPath);
  await file.save(buffer, { contentType, resumable: false });
  // create signed url
  const expires = Date.now() + 1000 * 60 * 60; // 1 hour
  const [url] = await file.getSignedUrl({ version: 'v4', action: 'read', expires });
  return { path: destinationPath, url, publicUrl: url };
};
