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
  // Props are now optional as we use ResizeObserver, but kept for compatibility if needed
  width?: number;
  height?: number;
}

const ImageViewer: React.FC<ImageViewerProps> = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [autoRotation, setAutoRotation] = useState(0); // Auto-rotation for FIT_BEST_AUTO_ROTATE mode
  const currentPageIndex = useViewerStore(state => state.currentPageIndex);
  const images = useViewerStore(state => state.images);
  const zoomLevel = useViewerStore(state => state.zoomLevel);
  const setZoomLevel = useViewerStore(state => state.setZoomLevel);
  const fitMode = useViewerStore(state => state.fitMode);
  const setFitMode = useViewerStore(state => state.setFitMode);
  const isFullscreen = useViewerStore(state => state.isFullscreen);
  const currentSource = useViewerStore(state => state.currentSource);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const currentImage = images[currentPageIndex];

  // ResizeObserver to measure container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      if (container) {
        setContainerSize({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!currentImage) {
      setImage(null);
      setImageError(null);
      setAutoRotation(0); // Reset auto-rotation
      return;
    }

    // Load image via IPC
    loadImageFromArchive(currentImage);
  }, [currentImage]);

  const loadImageFromArchive = async (img: any) => {
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
    // Use fallback if container hasn't been measured yet
    const containerWidth = containerSize.width || 800;
    const containerHeight = containerSize.height || 600;

    switch (fitMode) {
      case FitMode.FIT_WIDTH:
        // Fit image width to screen width
        return containerWidth / imageWidth;

      case FitMode.FIT_HEIGHT:
        // Fit image height to screen height
        return containerHeight / imageHeight;

      case FitMode.FIT_BEST:
        // Fit entire image within window (use smaller of width/height ratios)
        const widthRatio = containerWidth / imageWidth;
        const heightRatio = containerHeight / imageHeight;
        return Math.min(widthRatio, heightRatio);

      case FitMode.FIT_BEST_AUTO_ROTATE: {
        // Calculate zoom based on current autoRotation state
        if (autoRotation === -90) {
          // Calculate with rotation (swap width/height)
          const rotatedWidthRatio = containerWidth / imageHeight;
          const rotatedHeightRatio = containerHeight / imageWidth;
          return Math.min(rotatedWidthRatio, rotatedHeightRatio);
        } else {
          // Calculate without rotation
          const normalWidthRatio = containerWidth / imageWidth;
          const normalHeightRatio = containerHeight / imageHeight;
          return Math.min(normalWidthRatio, normalHeightRatio);
        }
      }

      case FitMode.ACTUAL_SIZE:
        // 100% actual size
        return 1.0;

      default:
        return zoomLevel;
    }
  };

  // Use calculated zoom when fit mode is active, but ensure smooth transitions
  const effectiveZoom = fitMode !== FitMode.CUSTOM ? calculateFitZoom() : zoomLevel;

  // Calculate auto-rotation for FIT_BEST_AUTO_ROTATE mode
  useEffect(() => {
    if (fitMode !== FitMode.FIT_BEST_AUTO_ROTATE || !image) {
      // Reset rotation for other modes
      if (fitMode !== FitMode.FIT_BEST_AUTO_ROTATE && autoRotation !== 0) {
        setAutoRotation(0);
      }
      return;
    }

    const containerWidth = containerSize.width || 800;
    const containerHeight = containerSize.height || 600;

    // Calculate zoom without rotation
    const normalWidthRatio = containerWidth / image.width;
    const normalHeightRatio = containerHeight / image.height;
    const normalZoom = Math.min(normalWidthRatio, normalHeightRatio);

    // Calculate zoom with 90° rotation (swap width/height)
    const rotatedWidthRatio = containerWidth / image.height;
    const rotatedHeightRatio = containerHeight / image.width;
    const rotatedZoom = Math.min(rotatedWidthRatio, rotatedHeightRatio);

    // Choose rotation that gives better zoom (larger image)
    // Use 10% threshold to avoid unnecessary rotation
    const shouldRotate = rotatedZoom > normalZoom * 1.1;
    setAutoRotation(shouldRotate ? -90 : 0); // -90 = counter-clockwise
  }, [fitMode, image, containerSize.width, containerSize.height]);

  // Calculate image boundaries
  const getImageBounds = () => {
    if (!image) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const imageWidth = image.width * effectiveZoom;
    const imageHeight = image.height * effectiveZoom;
    // Use fallback if container hasn't been measured yet
    const containerWidth = containerSize.width || 800;
    const containerHeight = containerSize.height || 600;

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

  // Recenter image when image, fitMode, zoomLevel, or containerSize changes
  useEffect(() => {
    if (!image) return;

    // Use fallback if container hasn't been measured yet
    const containerWidth = containerSize.width || 800;
    const containerHeight = containerSize.height || 600;

    // Calculate the current effective zoom based on fitMode
    let currentZoom = 1.0;
    let shouldRotate = false;

    if (fitMode !== FitMode.CUSTOM) {
      switch (fitMode) {
        case FitMode.FIT_WIDTH:
          currentZoom = containerWidth / image.width;
          break;
        case FitMode.FIT_HEIGHT:
          currentZoom = containerHeight / image.height;
          break;
        case FitMode.FIT_BEST:
          const widthRatio = containerWidth / image.width;
          const heightRatio = containerHeight / image.height;
          currentZoom = Math.min(widthRatio, heightRatio);
          break;
        case FitMode.FIT_BEST_AUTO_ROTATE: {
          // Calculate zoom without rotation
          const normalWidthRatio = containerWidth / image.width;
          const normalHeightRatio = containerHeight / image.height;
          const normalZoom = Math.min(normalWidthRatio, normalHeightRatio);

          // Calculate zoom with 90° rotation (swap width/height)
          const rotatedWidthRatio = containerWidth / image.height;
          const rotatedHeightRatio = containerHeight / image.width;
          const rotatedZoom = Math.min(rotatedWidthRatio, rotatedHeightRatio);

          // Choose rotation that gives better zoom (larger image)
          if (rotatedZoom > normalZoom * 1.1) {
            shouldRotate = true;
            currentZoom = rotatedZoom;
          } else {
            currentZoom = normalZoom;
          }
          break;
        }
        case FitMode.ACTUAL_SIZE:
          currentZoom = 1.0;
          break;
      }
    } else {
      currentZoom = zoomLevel;
    }

    // Calculate image dimensions (swap if rotated)
    const imageWidth = shouldRotate
      ? image.height * currentZoom
      : image.width * currentZoom;
    const imageHeight = shouldRotate
      ? image.width * currentZoom
      : image.height * currentZoom;

    // Calculate centered position
    const centeredX = (containerWidth - imageWidth) / 2;
    const centeredY = (containerHeight - imageHeight) / 2;

    // Constrain to bounds
    const newPosition = constrainPosition({ x: centeredX, y: centeredY });

    setStagePosition(newPosition);
  }, [image, fitMode, zoomLevel, containerSize.width, containerSize.height]);


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
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

  if (!currentImage || !image) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          backgroundColor: isFullscreen ? '#000000' : '#1e1e1e',
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

  // Use fallback dimensions if container hasn't been measured yet
  const stageWidth = containerSize.width || 800;
  const stageHeight = containerSize.height || 600;

  // Calculate rotation-aware image positioning
  const getImageProps = () => {
    if (!image) return { x: 0, y: 0, rotation: 0, offsetX: 0, offsetY: 0 };

    if (autoRotation === -90) {
      // For -90° rotation (counter-clockwise)
      // Rotate around the top-right corner to align to top-left after rotation
      return {
        x: 0,
        y: 0,
        rotation: -90,
        offsetX: image.width, // Rotate around right edge
        offsetY: 0,           // Top edge
      };
    }

    return {
      x: 0,
      y: 0,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
    };
  };

  const imageProps = getImageProps();

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isFullscreen ? '#000000' : '#1e1e1e',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Stage
        width={stageWidth}
        height={stageHeight}
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
            x={imageProps.x}
            y={imageProps.y}
            scaleX={effectiveZoom}
            scaleY={effectiveZoom}
            rotation={imageProps.rotation}
            offsetX={imageProps.offsetX}
            offsetY={imageProps.offsetY}
          />
        </Layer>
      </Stage>
    </div>
  );
};

export default ImageViewer;

