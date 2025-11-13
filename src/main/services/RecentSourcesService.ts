import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { SourceDescriptor } from '@shared/types/Source';

const MAX_RECENT = 10;

export class RecentSourcesService {
  private filePath: string;
  private cache: SourceDescriptor[] = [];

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'recent-sources.json');
    this.load();
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

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('Failed to save recent sources:', error);
    }
  }

  public getAll(): SourceDescriptor[] {
    return [...this.cache];
  }

  public add(source: SourceDescriptor) {
    this.cache = [source, ...this.cache.filter((item) => !(item.path === source.path && item.type === source.type))].slice(0, MAX_RECENT);
    this.save();
  }

  public clear() {
    this.cache = [];
    this.save();
  }

  public remove(source: SourceDescriptor) {
    this.cache = this.cache.filter((item) => !(item.path === source.path && item.type === source.type));
    this.save();
  }
}
