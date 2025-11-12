import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC invoke (async request-response)
  invoke: (channel: string, data?: unknown) => {
    return ipcRenderer.invoke(channel, data);
  },

  // IPC send one-way message
  send: (channel: string, data?: unknown) => {
    ipcRenderer.send(channel, data);
  },

  // IPC event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const wrappedListener = (_event: IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };

    ipcRenderer.on(channel, wrappedListener);
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, data?: unknown) => Promise<unknown>;
      send: (channel: string, data?: unknown) => void;
      on: (
        channel: string,
        callback: (...args: unknown[]) => void
      ) => () => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
