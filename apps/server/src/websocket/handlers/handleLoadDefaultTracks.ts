import { ExtractWSRequestFrom } from "@beatsync/shared";
import { listDefaultAudioFiles } from "../../lib/localStorage";
import { sendBroadcast } from "../../utils/responses";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleLoadDefaultTracks: HandlerFunction<
  ExtractWSRequestFrom["LOAD_DEFAULT_TRACKS"]
> = async ({ ws, server }) => {
  const { room } = requireCanMutate(ws);

  // List default audio files from local uploads/default directory
  const urls = listDefaultAudioFiles();
  if (!urls || urls.length === 0) {
    return;
  }

  // Existing room sources and simple URL set for dedupe
  const existingUrlSet = new Set(room.getAudioSources().map((s) => s.url));

  // Filter out any defaults already present in the room
  const toAdd = urls.filter((u) => !existingUrlSet.has(u.url));

  if (toAdd.length === 0) {
    console.log(
      `[${ws.data.roomId}] No new default tracks to add (all already present).`
    );
    return;
  }

  // Append only new sources
  for (const src of toAdd) {
    room.addAudioSource(src);
  }

  const updated = room.getAudioSources();

  sendBroadcast({
    server,
    roomId: ws.data.roomId,
    message: {
      type: "ROOM_EVENT",
      event: { type: "SET_AUDIO_SOURCES", sources: updated },
    },
  });
};

