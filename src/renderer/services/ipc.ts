/**
 * IPC Client Wrapper
 * Typed interface for invoking IPC methods from renderer process
 */

class IpcClient {
  private electronAPI = window.electronAPI;

  /**
   * Invoke an IPC method
   */
  public async invoke<T = unknown>(channel: string, data?: unknown): Promise<T> {
    try {
      const result = await this.electronAPI.invoke(channel, data);
      return result as T;
    } catch (error) {
      console.error(`IPC invoke error on channel "${channel}":`, error);
      throw error;
    }
  }

  /**
   * Send a one-way message (no response expected)
   */
  public send(channel: string, data?: unknown): void {
    this.electronAPI.send(channel, data);
  }

  /**
   * Listen to IPC events
   */
  public on(channel: string, callback: (...args: unknown[]) => void): () => void {
    return this.electronAPI.on(channel, callback);
  }

  /**
   * Remove all listeners for a channel
   */
  public removeAllListeners(channel: string): void {
    this.electronAPI.removeAllListeners(channel);
  }
}

// Singleton instance
const ipcClient = new IpcClient();

export default ipcClient;
