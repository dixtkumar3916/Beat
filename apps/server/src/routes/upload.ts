import { Server } from "bun";
import { generateAudioFileName, saveAudioFile } from "../lib/localStorage";
import { globalManager } from "../managers";
import { errorResponse, jsonResponse, sendBroadcast } from "../utils/responses";
import { WSData } from "../utils/websocket";

// Endpoint to handle direct file upload
export const handleUpload = async (req: Request, server: Server<WSData>) => {
  try {
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    // Parse formData instead of JSON
    const formData = await req.formData();
    const roomId = formData.get("roomId") as string | null;
    const file = formData.get("file") as File | null;

    if (!roomId || !file) {
      return errorResponse("Missing roomId or file in request", 400);
    }

    // Check if room exists
    const room = globalManager.getRoom(roomId);
    if (!room) {
      return errorResponse(
        "Room not found. Please join the room before uploading files.",
        404
      );
    }

    // Generate unique filename and save file locally
    const uniqueFileName = generateAudioFileName(file.name);

    // Save to local storage
    const publicUrl = await saveAudioFile(roomId, uniqueFileName, file);

    console.log(`✅ Audio upload completed locally - broadcasting to room ${roomId} new source`);

    // Add source to room
    const sources = room.addAudioSource({ url: publicUrl });

    // Broadcast to room that new audio is available
    sendBroadcast({
      server,
      roomId,
      message: {
        type: "ROOM_EVENT",
        event: {
          type: "SET_AUDIO_SOURCES",
          sources,
        },
      },
    });

    return jsonResponse({
      success: true,
      publicUrl,
    });
  } catch (error) {
    console.error("Error handling local upload:", error);
    return errorResponse("Failed to process upload", 500);
  }
};
