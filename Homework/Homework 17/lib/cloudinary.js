import cloudinary from "../config/cloudinary.js";

export async function uploadFile(fileBuffer, folder = "profiles") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    
    stream.end(fileBuffer);
  });
}

export async function deleteFile(publicId) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
}
