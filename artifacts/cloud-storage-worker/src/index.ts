// Cloudflare Worker Storage API Main Handler
// Endpoints for KBs, Seeds, Files (R2), Inventory, and Backup Exports

import { verifyWorkerAuth } from "./auth";
import { D1StorageService, type Env } from "./d1-service";

const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "text/javascript",
  "application/json",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "model/gltf-binary",
]);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ error }, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "");

    // Health check (no auth required)
    if (pathname === "/health" || pathname === "/healthz") {
      return jsonResponse({ status: "ok", service: "ayatrisya-cloud-storage", tier: "free-d1-r2" });
    }

    // Require Firebase Token for all storage and memory routes
    const authResult = await verifyWorkerAuth(
      request,
      env.FIREBASE_PROJECT_ID || "ayatrisya",
      env.SESSION_SECRET
    );
    if (!authResult.ok) {
      return errorResponse(authResult.error, authResult.status);
    }

    const ownerId = authResult.auth.uid;
    const defaultQuota = Number(env.DEFAULT_QUOTA_BYTES) || 524_288_000;
    const maxFileBytes = Number(env.MAX_FILE_BYTES) || 26_214_400;
    const globalQuota = Number(env.GLOBAL_STORAGE_QUOTA_BYTES) || 10_737_418_240;
    const reservedRatio = Number(env.RESERVED_CAPACITY_RATIO) || 0.90;
    const d1 = new D1StorageService(env.DB, defaultQuota, globalQuota, reservedRatio);

    try {
      // 1. Quota & Inventory & System Capacity
      if (pathname === "/api/storage/inventory" && request.method === "GET") {
        const quota = await d1.getOrCreateQuota(ownerId);
        const globalCapacity = await d1.getGlobalCapacityState();
        const kbs = await d1.listKnowledgeBases(ownerId, 1, 0);
        const seeds = await d1.listSeeds(ownerId, undefined, 1, 0);
        const files = await d1.listFiles(ownerId, 1, 0);
        const convs = await d1.listConversations(ownerId, 1, 0);

        return jsonResponse({
          quota,
          globalCapacity: {
            totalStoredBytes: globalCapacity.totalStoredBytes,
            maxGlobalBytes: globalCapacity.maxGlobalBytes,
            availableGlobalBytes: globalCapacity.availableGlobalBytes,
            isNearCapacityLimit: globalCapacity.isNearCapacityLimit,
            isCapacityExhausted: globalCapacity.isCapacityExhausted,
            reservedThresholdRatio: globalCapacity.reservedThresholdRatio,
          },
          inventory: {
            quota,
            knowledgeBasesCount: kbs.length,
            seedsCount: seeds.length,
            filesCount: files.length,
            conversationsCount: convs.length,
            totalStorageBytes: quota.usedBytes,
          },
        });
      }


      // Reconciliation / Maintenance Route
      if (pathname === "/api/storage/reconcile" && request.method === "POST") {
        // Find and clean expired or aborted pending uploads
        const expired = await d1.getExpiredPendingUploads(50);
        let cleanedCount = 0;
        for (const item of expired) {
          await env.BUCKET.delete(item.r2_key).catch(() => {});
          await d1.purgePendingUploadRecord(item.id).catch(() => {});
          cleanedCount++;
        }

        const reconciled = await d1.reconcileStorageAccounting();
        return jsonResponse({
          success: true,
          cleanedPendingUploads: cleanedCount,
          reconciledAccounting: reconciled,
        });
      }

      // 2. Conversations & Messages
      if (pathname === "/api/storage/conversations") {
        if (request.method === "GET") {
          const limit = Number(url.searchParams.get("limit") || 50);
          const offset = Number(url.searchParams.get("offset") || 0);
          const conversations = await d1.listConversations(ownerId, limit, offset);
          return jsonResponse({ conversations });
        }
        if (request.method === "POST") {
          const body = (await request.json().catch(() => null)) as { title?: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean } | null;
          if (!body?.title?.trim()) return errorResponse("Conversation title is required.");
          const created = await d1.createConversation(ownerId, body);
          return jsonResponse(created, 201);
        }
      }

      const convMatch = pathname.match(/^\/api\/storage\/conversations\/([a-zA-Z0-9_-]+)$/);
      if (convMatch) {
        const convId = convMatch[1];
        if (request.method === "GET") {
          const conv = await d1.getConversation(ownerId, convId);
          if (!conv) return errorResponse("Conversation not found.", 404);
          return jsonResponse(conv);
        }
        if (request.method === "PUT") {
          const body = (await request.json().catch(() => null)) as { title?: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean; archived?: boolean } | null;
          if (!body) return errorResponse("Invalid update body.");
          const updated = await d1.updateConversation(ownerId, convId, body);
          if (!updated) return errorResponse("Conversation not found.", 404);
          return jsonResponse(updated);
        }
        if (request.method === "DELETE") {
          const ok = await d1.deleteConversation(ownerId, convId);
          if (!ok) return errorResponse("Conversation not found.", 404);
          return jsonResponse({ success: true, deletedId: convId });
        }
      }

      const msgListMatch = pathname.match(/^\/api\/storage\/conversations\/([a-zA-Z0-9_-]+)\/messages$/);
      if (msgListMatch) {
        const convId = msgListMatch[1];
        if (request.method === "GET") {
          const messages = await d1.listMessages(ownerId, convId);
          return jsonResponse({ messages });
        }
        if (request.method === "POST") {
          const body = (await request.json().catch(() => null)) as { role?: "user" | "assistant"; content?: string; attachmentIds?: string[]; modelId?: string } | null;
          if (!body?.role || !body?.content) return errorResponse("Message role and content are required.");
          const created = await d1.addMessage(ownerId, convId, {
            role: body.role,
            content: body.content,
            attachmentIds: body.attachmentIds,
            modelId: body.modelId,
          });
          return jsonResponse(created, 201);
        }
      }

      const msgSingleMatch = pathname.match(/^\/api\/storage\/messages\/([a-zA-Z0-9_-]+)$/);
      if (msgSingleMatch && request.method === "DELETE") {
        const msgId = msgSingleMatch[1];
        await d1.deleteMessage(ownerId, msgId);
        return jsonResponse({ success: true, deletedId: msgId });
      }

      // 3. Knowledge Bases
      if (pathname === "/api/storage/kb") {
        if (request.method === "GET") {
          const limit = Number(url.searchParams.get("limit") || 50);
          const offset = Number(url.searchParams.get("offset") || 0);
          const kbs = await d1.listKnowledgeBases(ownerId, limit, offset);
          return jsonResponse({ knowledgeBases: kbs });
        }
        if (request.method === "POST") {
          const body = (await request.json().catch(() => null)) as { title?: string; description?: string; tags?: string[] } | null;
          if (!body?.title?.trim()) return errorResponse("Knowledge base title is required.");
          const created = await d1.createKnowledgeBase(ownerId, body);
          return jsonResponse(created, 201);
        }
      }


      const kbMatch = pathname.match(/^\/api\/storage\/kb\/([a-zA-Z0-9_-]+)$/);
      if (kbMatch) {
        const kbId = kbMatch[1];
        if (request.method === "GET") {
          const kb = await d1.getKnowledgeBase(ownerId, kbId);
          if (!kb) return errorResponse("Knowledge Base not found.", 404);
          return jsonResponse(kb);
        }
        if (request.method === "PUT") {
          const body = (await request.json().catch(() => null)) as { title?: string; description?: string; tags?: string[] } | null;
          if (!body) return errorResponse("Invalid update body.");
          const updated = await d1.updateKnowledgeBase(ownerId, kbId, body);
          if (!updated) return errorResponse("Knowledge Base not found.", 404);
          return jsonResponse(updated);
        }
        if (request.method === "DELETE") {
          const ok = await d1.deleteKnowledgeBase(ownerId, kbId);
          if (!ok) return errorResponse("Knowledge Base not found.", 404);
          return jsonResponse({ success: true, deletedId: kbId });
        }
      }

      // 3. Seed Memories
      if (pathname === "/api/storage/seeds") {
        if (request.method === "GET") {
          const kbId = url.searchParams.get("kbId") || undefined;
          const category = url.searchParams.get("category") || undefined;
          const pinnedParam = url.searchParams.get("pinned");
          const pinned = pinnedParam !== null ? pinnedParam === "true" : undefined;
          const limit = Number(url.searchParams.get("limit") || 50);
          const offset = Number(url.searchParams.get("offset") || 0);

          const seeds = await d1.listSeeds(ownerId, { kbId, category, pinned }, limit, offset);
          return jsonResponse({ seeds });
        }
        if (request.method === "POST") {
          const body = (await request.json().catch(() => null)) as {
            kbId?: string | null;
            title?: string;
            category?: string;
            content?: string;
            confidence?: number;
            pinned?: boolean;
          } | null;
          if (!body?.title?.trim() || !body?.content) {
            return errorResponse("Seed memory title and content are required.");
          }
          const created = await d1.createSeed(ownerId, {
            kbId: body.kbId,
            title: body.title,
            category: body.category,
            content: body.content,
            confidence: body.confidence,
            pinned: body.pinned,
          });
          return jsonResponse(created, 201);
        }
      }

      const seedMatch = pathname.match(/^\/api\/storage\/seeds\/([a-zA-Z0-9_-]+)$/);
      if (seedMatch) {
        const seedId = seedMatch[1];
        if (request.method === "GET") {
          const seed = await d1.getSeed(ownerId, seedId);
          if (!seed) return errorResponse("Seed Memory not found.", 404);
          return jsonResponse(seed);
        }
        if (request.method === "PUT") {
          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
          if (!body) return errorResponse("Invalid update body.");
          const updated = await d1.updateSeed(ownerId, seedId, body as any);
          if (!updated) return errorResponse("Seed Memory not found.", 404);
          return jsonResponse(updated);
        }
        if (request.method === "DELETE") {
          const ok = await d1.deleteSeed(ownerId, seedId);
          if (!ok) return errorResponse("Seed Memory not found.", 404);
          return jsonResponse({ success: true, deletedId: seedId });
        }
      }

      // 4. Cloud Files (R2 Object Storage + D1 References)
      if (pathname === "/api/storage/files") {
        if (request.method === "GET") {
          const limit = Number(url.searchParams.get("limit") || 50);
          const offset = Number(url.searchParams.get("offset") || 0);
          const files = await d1.listFiles(ownerId, limit, offset);
          return jsonResponse({ files });
        }
        if (request.method === "POST") {
          // Bounded multipart/binary upload to R2
          const filename = decodeURIComponent(request.headers.get("X-Filename") || "unnamed_file").slice(0, 255);
          const mimeType = (request.headers.get("X-Mimetype") || "application/octet-stream").toLowerCase();

          if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return errorResponse(`File type '${mimeType}' is not permitted in secure cloud storage.`, 415);
          }

          const arrayBuffer = await request.arrayBuffer();
          if (arrayBuffer.byteLength === 0) {
            return errorResponse("Cannot upload empty file.");
          }
          if (arrayBuffer.byteLength > maxFileBytes) {
            return errorResponse(`File size exceeds maximum upload limit of ${Math.round(maxFileBytes / 1024 / 1024)} MB.`, 413);
          }

          // 1. Capacity Management Guard: Check Global Capacity & Reserved Emergency Threshold
          const globalCapacity = await d1.getGlobalCapacityState();
          if (globalCapacity.isCapacityExhausted) {
            return errorResponse("Global cloud storage capacity is currently full. Contact support or try again later.", 507);
          }
          if (globalCapacity.totalStoredBytes + arrayBuffer.byteLength > globalCapacity.reservedThresholdBytes) {
            return errorResponse("System is operating in reserved-capacity protection mode. New uploads temporarily restricted.", 507);
          }

          // 2. User Quota Check
          const quota = await d1.getOrCreateQuota(ownerId);
          if (quota.usedBytes + arrayBuffer.byteLength > quota.maxBytes) {
            return errorResponse(`Storage quota exceeded: ${Math.round(quota.maxBytes / 1024 / 1024)} MB individual limit reached.`, 413);
          }

          const fileId = crypto.randomUUID();
          const r2Key = `users/${ownerId}/files/${fileId}`;

          // 3. Reliable Upload State Initiation in D1 (Anti-Orphan Tracker)
          await d1.createPendingUpload({
            id: fileId,
            ownerId,
            r2Key,
            sizeBytes: arrayBuffer.byteLength,
            ttlSeconds: 3600,
          });

          // 4. Atomic write to R2
          try {
            await d1.updatePendingUploadStatus(fileId, ownerId, "uploading");
            await env.BUCKET.put(r2Key, arrayBuffer, {
              httpMetadata: { contentType: mimeType },
              customMetadata: { ownerId, filename, uploadedAt: new Date().toISOString() },
            });
          } catch (r2Err) {
            await d1.updatePendingUploadStatus(fileId, ownerId, "aborted").catch(() => {});
            await env.BUCKET.delete(r2Key).catch(() => {});
            throw r2Err;
          }

          // 5. Finalize in D1 metadata and user/system accounting
          try {
            // Compute sha256 hash for integrity
            const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const sha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

            await d1.recordFileSaved(ownerId, {
              id: fileId,
              name: filename,
              mimeType,
              sizeBytes: arrayBuffer.byteLength,
              r2Key,
              sha256,
            });
            await d1.finalizePendingUpload(fileId, ownerId);

            return jsonResponse(
              {
                id: fileId,
                name: filename,
                mimeType,
                sizeBytes: arrayBuffer.byteLength,
                sha256,
                createdAt: new Date().toISOString(),
              },
              201
            );
          } catch (d1Err) {
            // Cleanup on failure
            await env.BUCKET.delete(r2Key).catch(() => {});
            await d1.updatePendingUploadStatus(fileId, ownerId, "aborted").catch(() => {});
            throw d1Err;
          }
        }
      }

      const fileMatch = pathname.match(/^\/api\/storage\/files\/([a-zA-Z0-9_-]+)$/);
      if (fileMatch) {
        const fileId = fileMatch[1];
        const fileMeta = await d1.getFile(ownerId, fileId);
        if (!fileMeta) return errorResponse("File record not found.", 404);

        if (request.method === "GET") {
          // Download directly from private R2 bucket
          const object = await env.BUCKET.get(fileMeta.r2Key);
          if (!object) return errorResponse("File binary data not found in object storage.", 404);

          return new Response(object.body, {
            status: 200,
            headers: {
              "Content-Type": fileMeta.mimeType,
              "Content-Length": String(fileMeta.sizeBytes),
              "Content-Disposition": `attachment; filename="${encodeURIComponent(fileMeta.name)}"`,
              "Cache-Control": "private, max-age=3600",
            },
          });
        }

        if (request.method === "DELETE") {
          // Delete from R2 then D1
          await env.BUCKET.delete(fileMeta.r2Key);
          await d1.recordFileDeleted(ownerId, fileId, fileMeta.sizeBytes);
          return jsonResponse({ success: true, deletedId: fileId });
        }
      }

      // 5. Cloud Data Export & Restore
      // Manifest-based metadata + integrity hash export
      if (pathname === "/api/storage/export" && request.method === "GET") {
        const kbs = await d1.listKnowledgeBases(ownerId, 500, 0);
        const seeds = await d1.listSeeds(ownerId, undefined, 2000, 0);
        const files = await d1.listFiles(ownerId, 500, 0);
        const conversations = await d1.listConversations(ownerId, 500, 0);
        const allMessages: any[] = [];
        for (const c of conversations) {
          const msgs = await d1.listMessages(ownerId, c.id);
          allMessages.push(...msgs);
        }

        return jsonResponse({
          format: "ayatrisya-cloud-export",
          version: 1,
          exportedAt: new Date().toISOString(),
          ownerId,
          knowledgeBases: kbs,
          seeds,
          conversations,
          messages: allMessages,
          files: files.map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            sha256: f.sha256,
            downloadPath: `/api/storage/files/${f.id}`,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })),
        });
      }

      // Restore Endpoint
      if (pathname === "/api/storage/restore" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as {
          knowledgeBases?: Array<{ title: string; description?: string; tags?: string[] }>;
          seeds?: Array<{ kbId?: string | null; title: string; category?: string; content: string; confidence?: number; pinned?: boolean }>;
          conversations?: Array<{ id?: string; title: string; mode?: "Normal" | "Savage" | "Joke"; pinned?: boolean }>;
          messages?: Array<{ conversationId: string; role: "user" | "assistant"; content: string; attachmentIds?: string[]; modelId?: string }>;
        } | null;

        if (!payload) return errorResponse("Invalid restore payload.", 400);

        let restoredKBs = 0;
        let restoredSeeds = 0;
        let restoredConversations = 0;
        let restoredMessages = 0;

        for (const kb of payload.knowledgeBases || []) {
          if (kb.title?.trim()) {
            await d1.createKnowledgeBase(ownerId, kb);
            restoredKBs++;
          }
        }

        for (const seed of payload.seeds || []) {
          if (seed.title?.trim() && seed.content) {
            await d1.createSeed(ownerId, seed as any);
            restoredSeeds++;
          }
        }

        const convIdMap = new Map<string, string>();
        for (const conv of payload.conversations || []) {
          if (conv.title?.trim()) {
            const created = await d1.createConversation(ownerId, conv);
            if (conv.id) convIdMap.set(conv.id, created.id);
            restoredConversations++;
          }
        }

        for (const msg of payload.messages || []) {
          const targetConvId = convIdMap.get(msg.conversationId) || msg.conversationId;
          if (targetConvId && msg.content) {
            await d1.addMessage(ownerId, targetConvId, {
              role: msg.role,
              content: msg.content,
              attachmentIds: msg.attachmentIds,
              modelId: msg.modelId,
            }).catch(() => {});
            restoredMessages++;
          }
        }

        return jsonResponse({
          success: true,
          restoredKBs,
          restoredSeeds,
          restoredConversations,
          restoredMessages,
        });
      }

      return errorResponse("Endpoint not found.", 404);

    } catch (err) {
      console.error("[StorageWorker Error]", err);
      return errorResponse(err instanceof Error ? err.message : "Internal storage error.", 500);
    }
  },
};

