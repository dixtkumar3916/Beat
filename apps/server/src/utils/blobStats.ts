import { getPublicAudioUrl, listAllRooms } from "../lib/localStorage";
import { globalManager } from "../managers";

// Helper function to format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Type definitions
interface FileInfo {
  key: string;
  size: string;
  sizeBytes: number;
  publicUrl: string;
}

interface RoomDetail {
  fileCount: number;
  totalSize: string;
  totalSizeBytes: number;
  files: FileInfo[];
}

interface BlobStats {
  error?: string;
  totalObjects: number;
  totalRooms: number;
  totalSize: string;
  totalSizeBytes: number;
  activeRooms: Record<string, RoomDetail>;
  orphanedRooms: Record<string, RoomDetail>;
  orphanedCount: number;
}

export async function getBlobStats(): Promise<BlobStats> {
  try {
    const allRoomsData = listAllRooms();

    let totalStorageSize = 0;
    let totalObjects = 0;

    // Get active rooms from server
    const activeRoomSet = new Set(globalManager.getRoomIds());

    // Separate active rooms from orphaned rooms
    const activeRoomDetails: Record<string, RoomDetail> = {};
    const orphanedRoomDetails: Record<string, RoomDetail> = {};

    allRoomsData.forEach((roomData) => {
      const roomId = roomData.roomId;
      let roomTotalSize = 0;

      const files = roomData.files.map((file) => {
        const filename = file.key.split("/").pop() || "";
        roomTotalSize += file.size;
        totalStorageSize += file.size;
        totalObjects++;

        return {
          key: file.key,
          size: formatBytes(file.size),
          sizeBytes: file.size,
          publicUrl: getPublicAudioUrl(roomId, filename),
        };
      });

      const roomDetail = {
        fileCount: roomData.files.length,
        totalSize: formatBytes(roomTotalSize),
        totalSizeBytes: roomTotalSize,
        files: files,
      };

      // Separate active from orphaned
      if (activeRoomSet.has(roomId)) {
        activeRoomDetails[roomId] = roomDetail;
      } else {
        orphanedRoomDetails[roomId] = roomDetail;
      }
    });

    const orphanedCount = Object.keys(orphanedRoomDetails).length;

    return {
      totalObjects,
      totalRooms: allRoomsData.length,
      totalSize: formatBytes(totalStorageSize),
      totalSizeBytes: totalStorageSize,
      activeRooms: activeRoomDetails,
      orphanedRooms: orphanedRoomDetails,
      orphanedCount,
    };
  } catch (error) {
    return {
      error: `Failed to check blob storage (local): ${error}`,
      totalObjects: 0,
      totalRooms: 0,
      totalSize: "0 B",
      totalSizeBytes: 0,
      activeRooms: {},
      orphanedRooms: {},
      orphanedCount: 0,
    };
  }
}
