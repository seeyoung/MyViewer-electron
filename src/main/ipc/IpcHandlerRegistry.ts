import { ipcMain, IpcMainInvokeEvent } from 'electron';

export type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown;

export class IpcHandlerRegistry {
    private handlers: Map<string, IpcHandler> = new Map();

    /**
     * Register an IPC handler
     */
    public register(channel: string, handler: IpcHandler): void {
        if (this.handlers.has(channel)) {
            console.warn(`IPC handler for channel "${channel}" is already registered. Overwriting...`);
        }

        this.handlers.set(channel, handler);
        ipcMain.handle(channel, handler);
    }

    /**
     * Unregister an IPC handler
     */
    public unregister(channel: string): void {
        if (this.handlers.has(channel)) {
            ipcMain.removeHandler(channel);
            this.handlers.delete(channel);
        }
    }

    /**
     * Unregister all IPC handlers
     */
    public unregisterAll(): void {
        this.handlers.forEach((_, channel) => {
            ipcMain.removeHandler(channel);
        });
        this.handlers.clear();
    }

    /**
     * Get list of registered channels
     */
    public getRegisteredChannels(): string[] {
        return Array.from(this.handlers.keys());
    }
}

// Singleton instance
const registry = new IpcHandlerRegistry();

export default registry;
