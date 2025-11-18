import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlideshowService } from './SlideshowService';

function createRepositoryMock() {
  return {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setEntries: vi.fn(),
    addEntry: vi.fn(),
    findByName: vi.fn(),
  };
}

describe('SlideshowService', () => {
  let repository: ReturnType<typeof createRepositoryMock>;
  let service: SlideshowService;

  beforeEach(() => {
    repository = createRepositoryMock();
    service = new SlideshowService({ repository: repository as any });
  });

  it('prevents duplicate slideshow names (case insensitive)', async () => {
    repository.findByName.mockReturnValue({ id: 'existing-id', name: 'Original' });

    await expect(service.createSlideshow('original')).rejects.toThrow('Slideshow name already exists');
  });

  it('creates slideshows with duplicates allowed by default', async () => {
    repository.findByName.mockReturnValue(null);
    repository.create.mockImplementation(() => undefined);

    const slideshow = await service.createSlideshow('Queue One');

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Queue One',
      allowDuplicates: true,
    }));
    expect(slideshow.allowDuplicates).toBe(true);
  });

  it('prevents renaming to an existing slideshow name', async () => {
    repository.findByName.mockReturnValue({ id: 'another-id', name: 'Conflicting' });

    await expect(service.updateSlideshow('current-id', { name: 'Conflicting' })).rejects.toThrow('Slideshow name already exists');
  });
});
