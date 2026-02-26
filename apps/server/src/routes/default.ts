import { GetDefaultAudioType } from "@beatsync/shared";
import { listDefaultAudioFiles } from "../lib/localStorage";
import { jsonResponse, errorResponse } from "../utils/responses";

export async function handleGetDefaultAudio(_req: Request) {
  try {
    // List all objects with "default/" prefix
    const files = listDefaultAudioFiles();

    if (!files || files.length === 0) {
      return jsonResponse([]);
    }

    // Map to array of objects with public URLs
    const response: GetDefaultAudioType = files.map((obj) => ({
      url: obj.url,
    }));

    return jsonResponse(response);
  } catch (error) {
    console.error("Failed to list default audio files:", error);
    return errorResponse("Failed to list default audio files", 500);
  }
}
