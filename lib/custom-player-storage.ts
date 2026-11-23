const DB_NAME = 'rjfm-custom-player'
const STORE_NAME = 'files'
const PLAYER_KEY = 'index-html'

function openPlayerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readCustomPlayerHtml(): Promise<string> {
  if (typeof indexedDB === 'undefined') return ''
  const db = await openPlayerDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(PLAYER_KEY)
    request.onsuccess = () => { db.close(); resolve(typeof request.result === 'string' ? request.result : '') }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

export async function saveCustomPlayerHtml(source: string): Promise<void> {
  const db = await openPlayerDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(source, PLAYER_KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export async function removeCustomPlayerHtml(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openPlayerDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(PLAYER_KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}
