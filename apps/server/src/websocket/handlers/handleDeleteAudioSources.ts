import { ExtractWSRequestFrom } from "@beatsync/shared";
import { existsSync, rmSync } from "fs";
import { extractFileInfoFromUrl, getFilePath } from "../../lib/localStorage";
import { sendBroadcast } from "../../utils/responses";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleDeleteAudioSources: HandlerFunction<
  ExtractWSRequestFrom["DELETE_AUDIO_SOURCES"]
> = async ({ ws, message, server }) => {
  const { room } = requireCanMutate(ws);

  // Get current URLs to validate the request
  const currentUrls = new Set(room.getAudioSources().map((s) => s.url));

  // Only process URLs that actually exist in the room
  const urlsToDelete = message.urls.filter((url) => currentUrls.has(url));

  if (urlsToDelete.length === 0) {
    return; // nothing to do, silent idempotency
  }

  // Delete local files and track which URLs were successfully processed
  const successfullyDeletedUrls = new Set<string>();
  const roomPrefix = `/room-${ws.data.roomId}/`;

  const deletionPromises = urlsToDelete.map(async (url) => {
    // Default/non-room tracks — no file to delete, just remove from state
    if (!url.includes(roomPrefix)) {
      successfullyDeletedUrls.add(url);
      return;
    }

    // Delete the local file
    try {
      const info = extractFileInfoFromUrl(url);
      if (!info) throw new Error(`Failed to extract file info from URL: ${url}`);

      const filePath = getFilePath(info.roomId, info.fileName);
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true });
        console.log(`🗑️ Deleted local file: ${filePath}`);
      }
      successfullyDeletedUrls.add(url);
    } catch (error) {
      console.error(`Failed to delete local file for URL ${url}:`, error);
    }
  });

  await Promise.all(deletionPromises);

  const urlsToRemove = Array.from(successfullyDeletedUrls);

  if (urlsToRemove.length === 0) {
    console.log("No URLs were successfully deleted, keeping all in queue");
    return;
  }

  // Remove only the successfully deleted sources from room state
  const { updated } = room.removeAudioSources(urlsToRemove);

  // Broadcast updated queue to all clients
  sendBroadcast({
    server,
    roomId: ws.data.roomId,
    message: {
      type: "ROOM_EVENT",
      event: { type: "SET_AUDIO_SOURCES", sources: updated },
    },
  });
};
