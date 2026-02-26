import { cleanupOrphanedRooms } from "../lib/localStorage";
import { globalManager } from "../managers";
import { errorResponse, jsonResponse } from "../utils/responses";

// We extract just the parameters needed for the response
interface CleanupResult {
  mode: "dry-run" | "live";
  orphanedRooms: { roomId: string; fileCount: number }[];
  totalRooms: number;
  totalFiles: number;
  deletedFiles: number;
}

export async function handleCleanup(req: Request) {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    const isLive = mode === "live";

    console.log(`🧹 Starting Local Orphaned Room Cleanup via API`);
    console.log(`Mode: ${isLive ? "LIVE (will delete files)" : "DRY RUN (no deletions)"}\n`);

    // Get active rooms from server
    const activeRooms = new Set<string>();
    globalManager.forEachRoom((room, roomId) => {
      activeRooms.add(roomId);
    });

    // Use the local storage cleanup function
    const cleanupResult = cleanupOrphanedRooms(activeRooms, isLive);

    const result: CleanupResult = {
      mode: isLive ? "live" : "dry-run",
      ...cleanupResult
    };

    return jsonResponse(result);

  } catch (error) {
    console.error("\n❌ Cleanup failed:", error);
    return errorResponse(`Cleanup failed: ${error}`, 500);
  }
}