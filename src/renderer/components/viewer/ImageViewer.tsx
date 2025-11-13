import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { useViewerStore } from '../../store/viewerStore';
import { FitMode } from '@shared/types/ViewingSession';
import { SourceType } from '@shared/types/Source';

type ImageLoadResponse = {
  data: string;
  format: string;
};

const isImageLoadResponse = (value: unknown): value is ImageLoadResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Partial<ImageLoadResponse>;
  return typeof response.data === 'string' && typeof response.format === 'string';
};

interface ImageViewerProps {
  width: number;
  height: number;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ width, height }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
  const images = useViewerStore(state => state.images);
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);
  const fitMode = useViewerStore(state => state.fitMode);
  const setFitMode = useViewerStore(state => state.setFitMode);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const currentSource = useViewerStore(state => state.currentSource);
  const stageRef = useRef<any>(null);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const currentImage = images[currentPageIndex];

  // 디버깅 로그 추가
  console.log('🔍 ImageViewer Debug:', {
    imagesLength: images.length,
    currentPageIndex,
    currentImage: currentImage ? {
      id: currentImage.id,
      pathInArchive: currentImage.pathInArchive,
      archiveId: currentImage.archiveId
    } : null,
    hasImage: !!image
  });

  useEffect(() => {
    if (!currentImage) {
      setImage(null);
      setImageError(null);
      return;
    }

    // Load image via IPC
    loadImageFromArchive(currentImage);
  }, [currentImage]);

  const loadImageFromArchive = async (img: any) => {
    console.log('📤 Loading image via IPC:', {
      archiveId: img.archiveId,
      imagePath: img.pathInArchive
    });
    
    try {
      // Load image via IPC
      const result = await window.electronAPI.invoke('image:load', {
        archiveId: img.archiveId,
        imagePath: img.pathInArchive,
        encoding: 'base64',
        sourceType: currentSource?.type ?? SourceType.ARCHIVE,
      });

      if (!isImageLoadResponse(result)) {
        throw new Error('Invalid response from image:load IPC');
      }

      console.log('📥 IPC Response received:', {
        hasData: !!result.data,
        format: result.format,
        dataLength: result.data?.length || 0
      });

      // Create HTML image element
      const htmlImage = new window.Image();
      htmlImage.onload = () => {
        setImage(htmlImage);
        setImageError(null);
      };
      htmlImage.onerror = (error) => {
        console.error('Failed to load image data:', error);
        setImage(null);
        setImageError('Failed to display this file.');
      };
      
      // Set image data as base64 data URL
      htmlImage.src = `data:image/${result.format};base64,${result.data}`;
    } catch (error) {
      console.error('Failed to load image:', error);
      setImage(null);
      setImageError('Failed to display this file.');
    }
  };

  // Calculate fit-to-screen zoom level
  const calculateFitZoom = () => {
    if (!image) return 1.0;

    const imageWidth = image.width;
    const imageHeight = image.height;
    const containerWidth = isFullscreen ? screenSize.width : width;
    const containerHeight = isFullscreen ? screenSize.height : height;

    switch (fitMode) {
      case FitMode.FIT_WIDTH:
        // Fit image width to screen width
        return containerWidth / imageWidth;

      case FitMode.FIT_HEIGHT:
        // Fit image height to screen height
        return containerHeight / imageHeight;

      case FitMode.ACTUAL_SIZE:
        // 100% actual size
        return 1.0;

      default:
        return zoomLevel;
    }
  };

  // Use calculated zoom when fit mode is active, but ensure smooth transitions
  const effectiveZoom = fitMode !== FitMode.CUSTOM ? calculateFitZoom() : zoomLevel;

  // Calculate image boundaries
  const getImageBounds = () => {
    if (!image) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const imageWidth = image.width * effectiveZoom;
    const imageHeight = image.height * effectiveZoom;
    const containerWidth = isFullscreen ? screenSize.width : width;
    const containerHeight = isFullscreen ? screenSize.height : height;

    // If image is smaller than viewport, center it and don't allow panning
    if (imageWidth <= containerWidth && imageHeight <= containerHeight) {
      const centerX = (containerWidth - imageWidth) / 2;
      const centerY = (containerHeight - imageHeight) / 2;
      return { minX: centerX, maxX: centerX, minY: centerY, maxY: centerY };
    }

    // Calculate bounds to keep image edges within viewport
    const minX = Math.min(0, containerWidth - imageWidth);
    const maxX = Math.max(0, containerWidth - imageWidth);
    const minY = Math.min(0, containerHeight - imageHeight);
    const maxY = Math.max(0, containerHeight - imageHeight);

    return { minX, maxX, minY, maxY };
  };

  // Constrain position within image bounds
  const constrainPosition = (pos: { x: number; y: number }) => {
    const bounds = getImageBounds();
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, pos.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, pos.y)),
    };
  };

  // Center the image when fit mode is active (only when mode changes, not during zoom)
  useEffect(() => {
    if (fitMode !== FitMode.CUSTOM && image) {
      const containerWidth = isFullscreen ? screenSize.width : width;
      const containerHeight = isFullscreen ? screenSize.height : height;

      // Calculate zoom for the specific fit mode
      let modeZoom = 1.0;
      switch (fitMode) {
        case FitMode.FIT_WIDTH:
          modeZoom = containerWidth / image.width;
          break;
        case FitMode.FIT_HEIGHT:
          modeZoom = containerHeight / image.height;
          break;
        case FitMode.ACTUAL_SIZE:
          modeZoom = 1.0;
          break;
      }

      const imageWidth = image.width * modeZoom;
      const imageHeight = image.height * modeZoom;

      setStagePosition({
        x: (containerWidth - imageWidth) / 2,
        y: (containerHeight - imageHeight) / 2,
      });
    }
  }, [fitMode, width, height, image, isFullscreen, screenSize]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
    };
  }, []);

  // Update screen size on window resize
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    
    // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
    const isZoomModifier = e.evt.metaKey || e.evt.ctrlKey;
    
    if (isZoomModifier) {
      // More natural zoom with variable speed based on current zoom level
      let scaleBy = 1.05; // Slower, more precise zoom
      
      // Adjust zoom sensitivity based on current zoom level for more natural feel
      if (effectiveZoom < 0.5) {
        scaleBy = 1.08; // Faster zoom when very zoomed out
      } else if (effectiveZoom > 3) {
        scaleBy = 1.03; // Slower zoom when very zoomed in
      }

      const stage = e.target.getStage();
      const oldScale = effectiveZoom;
      const pointer = stage.getPointerPosition();

      // More precise delta handling for smoother zoom
      const delta = e.evt.deltaY;
      const zoomDirection = delta > 0 ? -1 : 1;
      const zoomFactor = Math.pow(scaleBy, zoomDirection);
      
      const newScale = oldScale * zoomFactor;
      
      // Clamp zoom level between 0.05x and 20x (wider range for better UX)
      const clampedScale = Math.max(0.05, Math.min(20, newScale));
      
      // Disable fit mode first to prevent interference
      if (fitMode !== FitMode.CUSTOM) {
        setFitMode(FitMode.CUSTOM);
      }
      
      // Simple zoom without position adjustment
      setZoomLevel(clampedScale);
    } else {
      // Scroll functionality - pan the image
      const stage = e.target.getStage();
      const deltaX = e.evt.deltaX;
      const deltaY = e.evt.deltaY;
      
      const newPos = {
        x: stagePosition.x - deltaX,
        y: stagePosition.y - deltaY,
      };
      
      setStagePosition(constrainPosition(newPos));
    }
  };

  // Handle mouse movement for floating toolbar in image fullscreen mode
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isFullscreen) return;

    const mouseY = e.clientY;
    const threshold = 50; // Show toolbar when mouse is within 50px of top

    const floatingToolbar = document.querySelector('.navigation-bar.floating');
    if (floatingToolbar) {
      if (mouseY < threshold) {
        floatingToolbar.classList.add('visible');

        // Clear existing timeout
        if (toolbarTimeoutRef.current) {
          clearTimeout(toolbarTimeoutRef.current);
        }

        // Set timeout to hide toolbar after mouse leaves top area
        toolbarTimeoutRef.current = setTimeout(() => {
          floatingToolbar.classList.remove('visible');
        }, 2000);
      } else {
        // Hide toolbar when mouse moves away from top area
        if (toolbarTimeoutRef.current) {
          clearTimeout(toolbarTimeoutRef.current);
        }
        toolbarTimeoutRef.current = setTimeout(() => {
          floatingToolbar.classList.remove('visible');
        }, 500);
      }
    }
  };

  if (!currentImage || !image) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
        }}
      >
        {currentImage ? (imageError || 'Loading image...') : 'No image selected'}
      </div>
    );
  }

  const handleDragEnd = (e: any) => {
    const stage = e.target;
    const newPos = { x: stage.x(), y: stage.y() };
    setStagePosition(constrainPosition(newPos));
    
    // Switch to custom mode when dragging (except when already in custom mode)
    if (fitMode !== FitMode.CUSTOM) {
      setFitMode(FitMode.CUSTOM);
    }
  };

  return (
    <div
      style={{
        width: isFullscreen ? screenSize.width : width,
        height: isFullscreen ? screenSize.height : height,
        backgroundColor: isFullscreen ? '#000000' : '#1e1e1e',
        position: 'relative'
      }}
      onMouseMove={handleMouseMove}
    >
      <Stage
        width={isFullscreen ? screenSize.width : width}
        height={isFullscreen ? screenSize.height : height}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        ref={stageRef}
        x={stagePosition.x}
        y={stagePosition.y}
        draggable={true} // Always enable dragging
      >
        <Layer>
          <KonvaImage
            image={image}
            x={0}
            y={0}
            scaleX={effectiveZoom}
            scaleY={effectiveZoom}
          />
        </Layer>
      </Stage>
    </div>
  );
};

export default ImageViewer;
