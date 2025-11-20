import { create } from 'zustand';
import { ViewerSlice, createViewerSlice } from './slices/createViewerSlice';
import { UISlice, createUISlice } from './slices/createUISlice';
import { SlideshowSlice, createSlideshowSlice } from './slices/createSlideshowSlice';

export const DEFAULT_SLIDESHOW_NAME = 'Default';

export type ViewerState = ViewerSlice & UISlice & SlideshowSlice;

export const useViewerStore = create<ViewerState>()((...a) => ({
  ...createViewerSlice(...a),
  ...createUISlice(...a),
  ...createSlideshowSlice(...a),
}));
