import localforage from 'localforage'

const OLD_STORAGE_KEY = 'upath-pipeline'
const NEW_STORAGE_KEY = 'upath-autosave-session-v2-localforage'
const MIGRATION_FLAG_KEY = 'upath-migration-completed'

export async function performDataMigration(): Promise<void> {
  try {
    console.log('[Migration] Starting data migration from localStorage to IndexedDB')
    
    // Check if migration has already been completed
    const migrationCompleted = localStorage.getItem(MIGRATION_FLAG_KEY)
    if (migrationCompleted === 'true') {
      console.log('[Migration] Migration already completed, skipping')
      return
    }
    
    // Get existing data from localStorage
    const existingData = localStorage.getItem(OLD_STORAGE_KEY)
    
    if (existingData) {
      try {
        // Validate that it's valid JSON
        const parsedData = JSON.parse(existingData)
        
        console.log('[Migration] Found existing data, migrating to IndexedDB')
        
        try {
          // Save to localforage
          await localforage.setItem(NEW_STORAGE_KEY, existingData)
          
          // Remove from localStorage only after successful migration
          localStorage.removeItem(OLD_STORAGE_KEY)
          
          console.log('[Migration] Successfully migrated data')
        } catch (storageError) {
          console.error('[Migration] Failed to save to IndexedDB:', storageError)
          // Don't remove from localStorage if migration failed
          throw storageError
        }
      } catch (parseError) {
        console.error('[Migration] Failed to parse existing data:', parseError)
        // Continue to set migration flag even if parsing fails
      }
    } else {
      console.log('[Migration] No existing data to migrate')
    }
    
    // Set migration flag to prevent re-migration
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
    console.log('[Migration] Migration process completed')
    
  } catch (error) {
    console.error('[Migration] Error during migration:', error)
    // Still set migration flag to prevent repeated failed attempts
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true')
  }
}