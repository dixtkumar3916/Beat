import { R2_AUDIO_FILE_NAME_DELIMITER } from "@beatsync/shared";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs";
import { join, resolve } from "path";
import sanitize from "sanitize-filename";

// Base upload directory - relative to server root
const UPLOADS_DIR = resolve(import.meta.dir, "../../../uploads");

/**
 * Ensure a directory exists, creating it recursively if needed
 */
function ensureDir(dirPath: string): void {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}

// Ensure the uploads directory exists on startup
ensureDir(UPLOADS_DIR);

/**
 * Get the base URL for serving audio files.
 * In production, this uses the server's own URL. Locally it's http://localhost:8080.
 */
function getBaseUrl(): string {
    return process.env.PUBLIC_SERVER_URL || "http://localhost:8080";
}

/**
 * Create the filesystem path for a room's audio file
 */
export function getFilePath(roomId: string, fileName: string): string {
    return join(UPLOADS_DIR, `room-${roomId}`, fileName);
}

/**
 * Get the directory path for a room
 */
export function getRoomDir(roomId: string): string {
    return join(UPLOADS_DIR, `room-${roomId}`);
}

/**
 * Get the public URL for an audio file served by this server
 */
export function getPublicAudioUrl(roomId: string, fileName: string): string {
    const encodedFileName = encodeURIComponent(fileName);
    return `${getBaseUrl()}/audio/room-${roomId}/${encodedFileName}`;
}

/**
 * Extract roomId and fileName from a public URL
 */
export function extractFileInfoFromUrl(url: string): { roomId: string; fileName: string } | null {
    try {
        const urlObj = new URL(url);
        const match = urlObj.pathname.match(/^\/audio\/room-([^/]+)\/(.+)$/);
        if (!match) return null;
        return {
            roomId: match[1],
            fileName: decodeURIComponent(match[2]),
        };
    } catch {
        return null;
    }
}

/**
 * Save an audio file to local storage
 */
export async function saveAudioFile(
    roomId: string,
    fileName: string,
    data: ArrayBuffer | Uint8Array | Blob
): Promise<string> {
    const roomDir = getRoomDir(roomId);
    ensureDir(roomDir);

    const filePath = getFilePath(roomId, fileName);

    if (data instanceof Blob) {
        const buffer = await data.arrayBuffer();
        await Bun.write(filePath, buffer);
    } else {
        await Bun.write(filePath, data);
    }

    return getPublicAudioUrl(roomId, fileName);
}

/**
 * Check if an audio file exists locally
 */
export function validateAudioFileExists(audioUrl: string): boolean {
    const info = extractFileInfoFromUrl(audioUrl);
    if (!info) return false;

    const filePath = getFilePath(info.roomId, info.fileName);
    return existsSync(filePath);
}

/**
 * Serve an audio file - returns the Bun file object for streaming
 */
export function getAudioFile(roomId: string, fileName: string): ReturnType<typeof Bun.file> | null {
    const filePath = getFilePath(roomId, fileName);
    if (!existsSync(filePath)) return null;
    return Bun.file(filePath);
}

/**
 * Delete all files for a room
 */
export function deleteRoomFiles(roomId: string): { deletedCount: number } {
    const roomDir = getRoomDir(roomId);
    if (!existsSync(roomDir)) return { deletedCount: 0 };

    try {
        const files = readdirSync(roomDir);
        const count = files.length;
        rmSync(roomDir, { recursive: true, force: true });
        return { deletedCount: count };
    } catch (error) {
        console.error(`Failed to delete room files for ${roomId}:`, error);
        return { deletedCount: 0 };
    }
}

/**
 * List all files in a room's directory
 */
export function listRoomFiles(roomId: string): { key: string; size: number }[] {
    const roomDir = getRoomDir(roomId);
    if (!existsSync(roomDir)) return [];

    try {
        return readdirSync(roomDir)
            .filter((file) => !file.startsWith("."))
            .map((file) => {
                const filePath = join(roomDir, file);
                const stat = statSync(filePath);
                return {
                    key: `room-${roomId}/${file}`,
                    size: stat.size,
                };
            });
    } catch {
        return [];
    }
}

/**
 * List all room directories that exist in uploads
 */
export function listAllRooms(): { roomId: string; files: { key: string; size: number }[] }[] {
    if (!existsSync(UPLOADS_DIR)) return [];

    try {
        return readdirSync(UPLOADS_DIR)
            .filter((dir) => dir.startsWith("room-"))
            .map((dir) => {
                const roomId = dir.substring(5); // Remove "room-" prefix
                return {
                    roomId,
                    files: listRoomFiles(roomId),
                };
            });
    } catch {
        return [];
    }
}

/**
 * Generate a unique file name for audio uploads
 */
export function generateAudioFileName(originalName: string): string {
    const extension = originalName.split(".").pop() || "mp3";
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const nameWithoutSlashes = nameWithoutExt.replace(/[\/\\]/g, "-");

    let safeName = sanitize(nameWithoutSlashes, { replacement: "*" });

    const maxNameLength = 400;
    if (safeName.length > maxNameLength) {
        safeName = safeName.substring(0, maxNameLength);
    }

    if (!safeName) {
        safeName = "audio";
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(":", "-");

    return `${safeName}${R2_AUDIO_FILE_NAME_DELIMITER}${dateStr}.${extension}`;
}

// ============================================================
// Backup functions (replace R2 backup)
// ============================================================

const BACKUP_DIR = join(UPLOADS_DIR, "state-backup");

/**
 * Save a JSON backup to local filesystem
 */
export async function saveBackup(data: object): Promise<string> {
    ensureDir(BACKUP_DIR);

    const now = new Date();
    const timestamp = now
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, -5);
    const filename = `backup-${timestamp}.json`;
    const filePath = join(BACKUP_DIR, filename);

    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return filename;
}

/**
 * Load the latest backup from local filesystem
 */
export async function loadLatestBackup(): Promise<{ key: string; data: any } | null> {
    if (!existsSync(BACKUP_DIR)) return null;

    const files = readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse(); // Newest first (lexicographic sort on timestamps)

    if (files.length === 0) return null;

    const latestFile = files[0];
    const filePath = join(BACKUP_DIR, latestFile);

    try {
        const file = Bun.file(filePath);
        const text = await file.text();
        return {
            key: latestFile,
            data: JSON.parse(text),
        };
    } catch (error) {
        console.error(`Failed to load backup ${latestFile}:`, error);
        return null;
    }
}

/**
 * Clean up old backup files, keeping the most recent N
 */
export function cleanupOldBackups(keepCount: number = 5): void {
    if (!existsSync(BACKUP_DIR)) return;

    const files = readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse(); // Newest first

    if (files.length <= keepCount) return;

    const toDelete = files.slice(keepCount);
    for (const file of toDelete) {
        try {
            rmSync(join(BACKUP_DIR, file), { force: true });
            console.log(`  🗑️ Deleted old backup: ${file}`);
        } catch (error) {
            console.error(`  ❌ Failed to delete backup ${file}:`, error);
        }
    }
}

/**
 * Clean up orphaned room directories that are not in the active rooms set
 */
export function cleanupOrphanedRooms(
    activeRoomIds: Set<string>,
    performDeletion: boolean = false
): {
    orphanedRooms: { roomId: string; fileCount: number }[];
    totalRooms: number;
    totalFiles: number;
    deletedFiles: number;
} {
    const result = {
        orphanedRooms: [] as { roomId: string; fileCount: number }[],
        totalRooms: 0,
        totalFiles: 0,
        deletedFiles: 0,
    };

    const allRooms = listAllRooms();
    const orphanedRooms = allRooms.filter((r) => !activeRoomIds.has(r.roomId));

    result.totalRooms = orphanedRooms.length;
    result.orphanedRooms = orphanedRooms.map((r) => ({
        roomId: r.roomId,
        fileCount: r.files.length,
    }));
    result.totalFiles = orphanedRooms.reduce((sum, r) => sum + r.files.length, 0);

    if (performDeletion) {
        for (const room of orphanedRooms) {
            const deleteResult = deleteRoomFiles(room.roomId);
            result.deletedFiles += deleteResult.deletedCount;
            console.log(`  ✅ Deleted orphaned room-${room.roomId}: ${deleteResult.deletedCount} files`);
        }
    }

    return result;
}

/**
 * List default audio files from the default/ directory
 */
export function listDefaultAudioFiles(): { url: string }[] {
    const defaultDir = join(UPLOADS_DIR, "default");
    if (!existsSync(defaultDir)) return [];

    try {
        return readdirSync(defaultDir)
            .filter((file) => !file.startsWith("."))
            .map((file) => ({
                url: `${getBaseUrl()}/audio/default/${encodeURIComponent(file)}`,
            }));
    } catch {
        return [];
    }
}
