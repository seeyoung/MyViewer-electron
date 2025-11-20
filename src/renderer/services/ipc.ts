import * as channels from '@shared/constants/ipc-channels';

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
    } catch (error: any) {
      // Don't log ENOENT errors as errors, as they are often expected (e.g. missing files)
      if (error?.message?.includes('ENOENT')) {
        console.warn(`IPC invoke warning on channel "${channel}":`, error.message);
      } else {
        console.error(`IPC invoke error on channel "${channel}":`, error);
      }
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

  public async listSlideshows() {
    return this.invoke(channels.SLIDESHOW_LIST);
  }

  public async getSlideshow(id: string) {
    return this.invoke(channels.SLIDESHOW_GET, { id });
  }

  public async createSlideshow(name: string, description?: string) {
    return this.invoke(channels.SLIDESHOW_CREATE, { name, description });
  }

  public async updateSlideshow(id: string, payload: { name?: string; description?: string; allowDuplicates?: boolean }) {
    return this.invoke(channels.SLIDESHOW_UPDATE, { id, ...payload });
  }

  public async deleteSlideshow(id: string) {
    return this.invoke(channels.SLIDESHOW_DELETE, { id });
  }

  public async setSlideshowEntries(slideshowId: string, entries: unknown[]) {
    return this.invoke(channels.SLIDESHOW_SET_ENTRIES, { slideshowId, entries });
  }

  public async addSlideshowEntry(slideshowId: string, entry: unknown, position?: number) {
    return this.invoke(channels.SLIDESHOW_ADD_ENTRY, { slideshowId, entry, position });
  }
}

// Singleton instance
const ipcClient = new IpcClient();

export default ipcClient;
