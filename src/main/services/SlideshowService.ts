import { randomUUID } from 'crypto';
import { SlideshowRepository } from '../repositories/SlideshowRepository';
import { Slideshow, SlideshowEntry } from '@shared/types/slideshow';

interface SlideshowServiceDeps {
  repository: SlideshowRepository;
}

export class SlideshowService {
  private repository: SlideshowRepository;

  constructor({ repository }: SlideshowServiceDeps) {
    this.repository = repository;
  }

  private ensureUniqueName(name: string, excludeId?: string) {
    const existing = this.repository.findByName(name);
    if (existing && existing.id !== excludeId) {
      throw new Error('Slideshow name already exists');
    }
  }

  async listSlideshows(): Promise<Slideshow[]> {
    return this.repository.getAll();
  }

  async getSlideshow(id: string) {
    return this.repository.getById(id);
  }

  async createSlideshow(name: string, description?: string): Promise<Slideshow> {
    if (!name?.trim()) {
      throw new Error('Slideshow name is required');
    }
    const trimmedName = name.trim();
    this.ensureUniqueName(trimmedName);
    const slideshow: Slideshow = {
      id: randomUUID(),
      name: trimmedName,
      description: description?.trim() || undefined,
      allowDuplicates: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.repository.create(slideshow);
    return slideshow;
  }

  async updateSlideshow(id: string, payload: { name?: string; description?: string; allowDuplicates?: boolean }) {
    const sanitized: Partial<Omit<Slideshow, 'id'>> = {
      updatedAt: Date.now(),
    };
    if (payload.name !== undefined) {
      const trimmed = payload.name.trim();
      if (!trimmed) {
        throw new Error('Slideshow name cannot be empty');
      }
      this.ensureUniqueName(trimmed, id);
      sanitized.name = trimmed;
    }
    if (payload.description !== undefined) {
      sanitized.description = payload.description.trim() || undefined;
    }
    if (payload.allowDuplicates !== undefined) {
      sanitized.allowDuplicates = payload.allowDuplicates;
    }
    return this.repository.update(id, sanitized);
  }

  async deleteSlideshow(id: string): Promise<void> {
    this.repository.delete(id);
  }

  async setEntries(slideshowId: string, entries: SlideshowEntry[]): Promise<void> {
    const normalized = entries.map((entry, index) => ({
      ...entry,
      slideshowId,
      position: index,
    }));
    this.repository.setEntries(slideshowId, normalized);
  }

  async addEntry(slideshowId: string, entry: Omit<SlideshowEntry, 'position'>, position?: number) {
    return this.repository.addEntry(slideshowId, { ...entry, position });
  }
}
