const DB_NAME = 'chat-wrapped-local'
const VERSION = 1
type StoreName = 'analysis' | 'telemetry'

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('analysis')) db.createObjectStore('analysis')
      if (!db.objectStoreNames.contains('telemetry')) db.createObjectStore('telemetry', { autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function idbSet(store: StoreName, key: IDBValidKey, value: unknown) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  }); db.close()
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey) {
  const db = await openDb()
  const result = await new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key)
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  }); db.close(); return result
}

export async function idbDelete(store: StoreName, key: IDBValidKey) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
  }); db.close()
}
