import { openDB, type IDBPDatabase } from "idb";

export const DATABASE_VERSION = 4;
export const stores = [
  "profiles", "conversations", "messages", "projects", "projectItems",
  "attachments", "blobs", "preferences", "syncQueue", "syncMetadata",
] as const;
export type StoreName = typeof stores[number];

export function openLocalDatabase(name = "ayatrisya-local"): Promise<IDBPDatabase> {
  let connection: IDBPDatabase | undefined;
  return openDB(name, DATABASE_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        for (const name of stores.filter(s => s !== "syncQueue" && s !== "syncMetadata")) {
          const store = db.createObjectStore(name, { keyPath: ["ownerId", "id"] });
          store.createIndex("ownerId", "ownerId");
          if (name === "messages") store.createIndex("conversation", ["ownerId", "conversationId"]);
        }
      }
      if (oldVersion < 2) {
        for (const name of ["syncQueue", "syncMetadata"]) {
          const store = db.createObjectStore(name, { keyPath: ["ownerId", "id"] });
          store.createIndex("ownerId", "ownerId");
        }
      }
      if (oldVersion < 3) transaction.objectStore("conversations").createIndex("recent",["ownerId","updatedAt"]);
      if (oldVersion < 4) {
        // Additive migration: keep IDs, timestamps and content unchanged.
        for (const name of ["conversations","projects"] as const) {
          void transaction.objectStore(name).openCursor().then(async function migrate(cursor):Promise<void>{
            if(!cursor)return;
            await cursor.update({pinned:false,archived:false,...(name==="projects"?{color:"violet",icon:"folder"}:{}),...cursor.value});
            await migrate(await cursor.continue());
          });
        }
      }
    },
    blocking() { connection?.close(); },
  }).then(db => { connection = db; return db; });
}

export function openTasksDatabase(name = "ayatrisya-tasks"): Promise<IDBPDatabase> {
  let connection: IDBPDatabase | undefined;
  return openDB(name, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("scheduledTasks")) {
        const store = db.createObjectStore("scheduledTasks", { keyPath: ["ownerId", "id"] });
        store.createIndex("ownerId", "ownerId");
      }
      if (!db.objectStoreNames.contains("taskLogs")) {
        const store = db.createObjectStore("taskLogs", { keyPath: ["ownerId", "id"] });
        store.createIndex("ownerId", "ownerId");
      }
    },
    blocking() { connection?.close(); },
  }).then(db => { connection = db; return db; });
}
