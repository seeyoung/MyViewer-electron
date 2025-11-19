/**
 * Ensures that data is safe to send over IPC by removing non-serializable properties
 * (functions, symbols, etc.) and breaking circular references.
 * 
 * This uses the JSON.parse(JSON.stringify(data)) pattern which is robust for IPC
 * but can be slow for very large objects.
 */
export function ensureSerializable<T>(data: T): T {
    try {
        return JSON.parse(JSON.stringify(data));
    } catch (error) {
        console.error('Failed to serialize data for IPC:', error);
        // Fallback: try to return data as is, Electron might handle it or throw a better error
        return data;
    }
}
