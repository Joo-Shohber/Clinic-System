import { cloudinary } from "../config/cloudinary";
import { UploadApiResponse } from "cloudinary";

export async function uploadImage(
  fileBuffer: Buffer,
  folder: string,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err || !result)
          return reject(err ?? new Error("Upload failed From Cloudinary"));
        resolve(result);
      },
    );

    stream.end(fileBuffer);
  });
}

export async function uploadImages(
  files: Buffer[],
  folder: string,
  retries = 3,
) {
  let toUpload = files;
  const success: UploadApiResponse[] = [];

  for (let i = 0; i < retries; i++) {
    const results = await Promise.allSettled(
      toUpload.map((file) => uploadImage(file, folder)),
    );

    const failed: Buffer[] = [];

    results.forEach((r, index) => {
      const file = toUpload[index];

      if (r.status === "fulfilled") {
        success.push(r.value);
      } else {
        failed.push(file);
      }
    });

    if (failed.length === 0) break;

    toUpload = failed;
  }

  return success;
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
