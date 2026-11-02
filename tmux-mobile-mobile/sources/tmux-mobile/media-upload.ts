import type { ImagePickerAsset, ImagePickerOptions } from "expo-image-picker";

export const MEDIA_LIBRARY_OPTIONS: ImagePickerOptions = {
  mediaTypes: ["images", "videos"],
  allowsMultipleSelection: true,
  quality: 1,
};

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif", avif: "image/avif",
  mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v",
  webm: "video/webm", avi: "video/x-msvideo", mkv: "video/x-matroska",
};

export function mediaUploadAsset(asset: Pick<ImagePickerAsset, "uri" | "fileName" | "mimeType" | "type">) {
  const uriName = asset.uri.split(/[?#]/, 1)[0].split("/").pop();
  const name = asset.fileName || uriName || `media-${Date.now()}`;
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const uriExtension = uriName?.split(".").pop()?.toLowerCase() || "";
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType || MIME_TYPES[extension] || MIME_TYPES[uriExtension] || "application/octet-stream",
  };
}
