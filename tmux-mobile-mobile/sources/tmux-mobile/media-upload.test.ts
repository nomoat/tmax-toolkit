import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEDIA_LIBRARY_OPTIONS, mediaUploadAsset } from "./media-upload";
import { getInfoAsync, readAsStringAsync, uploadAsync } from "expo-file-system/legacy";
import { ApiError, TmuxMobileApi } from "./api";

vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));
vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  getInfoAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: vi.fn(),
}));

describe("photo and video uploads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets both upload entry points select mixed photos and videos", () => {
    expect(MEDIA_LIBRARY_OPTIONS.mediaTypes).toEqual(["images", "videos"]);
    expect(MEDIA_LIBRARY_OPTIONS.allowsMultipleSelection).toBe(true);
  });

  it.each([
    ["clip.MOV", "video/quicktime"], ["clip.mp4", "video/mp4"],
    ["clip.webm", "video/webm"], ["photo.HEIC", "image/heic"],
    ["photo.jpg", "image/jpeg"], ["photo.png", "image/png"],
  ])("infers %s without mislabelling videos as JPEG", (name, mimeType) => {
    expect(mediaUploadAsset({ uri: `file:///cache/${name}`, fileName: null }).mimeType).toBe(mimeType);
  });

  it("retains native metadata and keeps unknown videos generic", () => {
    expect(mediaUploadAsset({ uri: "file:///cache/export.mov", fileName: "recording.mov", mimeType: "video/quicktime", type: "video" }))
      .toEqual({ uri: "file:///cache/export.mov", name: "recording.mov", mimeType: "video/quicktime" });
    expect(mediaUploadAsset({ uri: "content://library/42", type: "video" }))
      .toEqual({ uri: "content://library/42", name: "42", mimeType: "application/octet-stream" });
  });

  it.each([25 * 1024 * 1024 + 1, 2 * 1024 * 1024 * 1024])("streams a %i-byte video to storage without reading it into JavaScript", async (size) => {
    vi.mocked(getInfoAsync).mockResolvedValue({ exists: true, uri: "file:///clip.mov", isDirectory: false, modificationTime: 0, size });
    vi.mocked(uploadAsync).mockResolvedValue({ status: 200, body: "", headers: {}, mimeType: null });
    const api = new TmuxMobileApi("https://eng.xyznot.com", "private-controller-token");
    const request = vi.spyOn(api, "request")
      .mockResolvedValueOnce({ upload: { url: "https://storage.example/upload", method: "PUT", headers: { "content-type": "video/quicktime", "if-none-match": "*" } }, ticket: "upload-ticket" })
      .mockResolvedValueOnce({ url: "https://eng.xyznot.com/files/download/clip.mov", expiresAt: "2026-10-27T12:00:00Z" });
    const result = await api.uploadFile("machine", "%3", { uri: "file:///clip.mov", name: "clip.mov", type: "video/quicktime" });
    expect(result.url).toBe("https://eng.xyznot.com/files/download/clip.mov");
    expect(request).toHaveBeenNthCalledWith(1, "/api/uploads", {
      method: "POST", body: { name: "clip.mov", size, contentType: "video/quicktime" },
    });
    expect(uploadAsync).toHaveBeenCalledWith("https://storage.example/upload", "file:///clip.mov", {
      httpMethod: "PUT", uploadType: 0, headers: { "content-type": "video/quicktime", "if-none-match": "*" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/api/uploads/complete", { method: "POST", body: { ticket: "upload-ticket" } });
    expect(readAsStringAsync).not.toHaveBeenCalled();
  });

  it("does not complete a rejected storage upload or leak the Controller token", async () => {
    vi.mocked(getInfoAsync).mockResolvedValue({ exists: true, uri: "file:///clip.mov", isDirectory: false, modificationTime: 0, size: 42 });
    vi.mocked(uploadAsync).mockResolvedValue({ status: 403, body: "expired", headers: {}, mimeType: null });
    const api = new TmuxMobileApi("https://eng.xyznot.com", "private-token");
    const request = vi.spyOn(api, "request").mockResolvedValue({ upload: { url: "https://storage.example/upload", method: "PUT", headers: {} }, ticket: "ticket" });
    await expect(api.uploadFile("machine", "%3", { uri: "file:///clip.mov", name: "clip.mov" })).rejects.toThrow("expired or was rejected");
    expect(request).toHaveBeenCalledTimes(1);
    expect(uploadAsync).toHaveBeenCalledWith("https://storage.example/upload", "file:///clip.mov", expect.objectContaining({ headers: {} }));
  });

  it("keeps local-only Controllers working with a native streamed upload", async () => {
    vi.mocked(getInfoAsync).mockResolvedValue({ exists: true, uri: "file:///clip.mov", isDirectory: false, modificationTime: 0, size: 42 });
    vi.mocked(uploadAsync).mockResolvedValue({ status: 200, body: JSON.stringify({ path: "/tmp/clip.mov" }), headers: {}, mimeType: null });
    const api = new TmuxMobileApi("https://eng.xyznot.com", "local-token");
    vi.spyOn(api, "request").mockRejectedValue(new ApiError("unavailable", 501));
    expect(await api.uploadFile("machine", "%3", { uri: "file:///clip.mov", name: "clip.mov" })).toEqual({ path: "/tmp/clip.mov" });
    expect(uploadAsync).toHaveBeenCalledWith("https://eng.xyznot.com/api/upload?paneId=%253&name=clip.mov", "file:///clip.mov", expect.objectContaining({
      httpMethod: "POST", headers: { authorization: "Bearer local-token", "x-machine-id": "machine", "content-type": "application/octet-stream" },
    }));
    expect(readAsStringAsync).not.toHaveBeenCalled();
  });

  it("asks for a new selection when the cached file disappeared", async () => {
    vi.mocked(getInfoAsync).mockResolvedValue({ exists: false, uri: "file:///gone.mov", isDirectory: false });
    await expect(new TmuxMobileApi().uploadFile("machine", "%3", { uri: "file:///gone.mov", name: "gone.mov" }))
      .rejects.toThrow("select it again");
    expect(readAsStringAsync).not.toHaveBeenCalled();
  });
});
