import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { SourceDescriptor } from '@shared/types/Source';

const MAX_RECENT = 10;

export class RecentSourcesService {
  private filePath: string;
  private cache: SourceDescriptor[] = [];

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'recent-sources.json');
    this.load(); // Initial load can be sync to ensure data is ready on startup
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cache = parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load recent sources:', error);
      this.cache = [];
    }
  }

  private async save() {
    try {
      await fsPromises.writeFile(this.filePath, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('Failed to save recent sources:', error);
    }
  }

  public getAll(): SourceDescriptor[] {
    return [...this.cache];
  }

  public async add(source: SourceDescriptor) {
    this.cache = [source, ...this.cache.filter((item) => !(item.path === source.path && item.type === source.type))].slice(0, MAX_RECENT);
    await this.save();
  }

  public async clear() {
    this.cache = [];
    await this.save();
  }

  public async remove(source: SourceDescriptor) {
    this.cache = this.cache.filter((item) => !(item.path === source.path && item.type === source.type));
    await this.save();
  }
}
