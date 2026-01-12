const multer = require('multer');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

// Lazily initialize the storage client and bucket so the module can be
// required even when GCS isn't configured in the environment.
let storageClient = null;
let bucket = null;
function getBucket() {
  if (bucket) return bucket;
  const keyFile = process.env.GCP_KEY_FILE || path.join(__dirname, 'gcs-key.json');
  const projectId = process.env.GCP_PROJECT_ID || 'connect-with-your-artist';
  const bucketName = process.env.GCS_BUCKET_NAME || process.env.GCP_BUCKET_NAME || 'www.connectartist.in';
  if (!bucketName) return null;
  storageClient = new Storage({ keyFilename: keyFile, projectId });
  bucket = storageClient.bucket(bucketName);
  return bucket;
}

// ⚙️ Multer setup
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

// ⬆️ Single file upload to GCS
async function uploadToGCS(file, folder = '') {
  return new Promise((resolve, reject) => {
    const safeName = file.originalname.replace(/\s+/g, '_');
  const bk = getBucket();
  if (!bk) throw new Error('GCS bucket not configured. Set GCS_BUCKET_NAME or GCP_BUCKET_NAME environment variable.');
  const blob = bk.file(`${folder}/${Date.now()}-${safeName}`);

  const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      predefinedAcl: 'publicRead',
    });

    blobStream.on('error', (err) => reject(err));
    blobStream.on('finish', () => {
  const publicUrl = `https://storage.googleapis.com/${bk.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
}

// 📦 Helper to process all uploaded files in req.files
async function handleUploads(req) {
  const files = req.files;
  const uploads = {
    avatarUrl: null,
    bannerUrl: null,
    photos: [],
    audios: [],
    videos: []
  };

  // Avatar
  if (files.avatar && files.avatar.length > 0) {
    uploads.avatarUrl = await uploadToGCS(files.avatar[0], 'avatars');
  }

  // Banner
  if (files.bannerImage && files.bannerImage.length > 0) {
    uploads.bannerUrl = await uploadToGCS(files.bannerImage[0], 'banners');
  }

  // Photos
  if (files.photos && files.photos.length > 0) {
    for (const file of files.photos) {
      const url = await uploadToGCS(file, 'photos');
      uploads.photos.push({ url });
    }
  }

  // Audios
  if (files.audios && files.audios.length > 0) {
    for (const file of files.audios) {
      const url = await uploadToGCS(file, 'audios');
      uploads.audios.push({ url });
    }
  }

  // Videos
  if (files.videos && files.videos.length > 0) {
    for (const file of files.videos) {
      const url = await uploadToGCS(file, 'videos');
      uploads.videos.push({ url });
    }
  }

  return uploads;
}

module.exports = {
  upload,
  uploadToGCS,
  handleUploads
};
