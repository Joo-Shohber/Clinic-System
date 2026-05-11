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

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
