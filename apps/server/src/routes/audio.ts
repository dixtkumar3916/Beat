import { Server } from "bun";
import { errorResponse, corsHeaders } from "../utils/responses";
import { getAudioFile } from "../lib/localStorage";

export const handleAudioRequest = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");

    // Example path: /audio/room-123/file.mp3
    // parts[0] = "", parts[1] = "audio", parts[2] = "room-123", parts[3] = "file.mp3"
    // Example default: /audio/default/file.mp3
    // parts[0] = "", parts[1] = "audio", parts[2] = "default", parts[3] = "file.mp3"

    if (pathParts.length < 4 || pathParts[1] !== "audio") {
      return errorResponse("Invalid audio URL format", 400);
    }

    const roomOrDefault = pathParts[2];
    let roomId = "";

    if (roomOrDefault.startsWith("room-")) {
      roomId = roomOrDefault.substring(5); // Remove "room-" prefix
    } else if (roomOrDefault === "default") {
      roomId = "default"; // special case for default audio directory
    } else {
      return errorResponse("Invalid audio URL format", 400);
    }

    const fileName = decodeURIComponent(pathParts.slice(3).join("/"));

    const file = getAudioFile(roomId === "default" ? "default" : roomId, fileName);
    if (!file) {
      return errorResponse("Audio file not found", 404);
    }

    return new Response(file, {
      headers: {
        ...corsHeaders,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Error handling audio request:", error);
    return errorResponse("Failed to process audio request", 500);
  }
};
