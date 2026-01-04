import { ComponentType } from 'react';
import ImageProcessor from '../components/ImageProcessor';
import PdfProcessor from '../components/PdfProcessor';
import VideoProcessor from '../components/VideoProcessor';
import TextProcessor from '../components/TextProcessor';
import type { BaseProcessorProps } from '../types/processor';

type ProcessorComponent = ComponentType<BaseProcessorProps & Record<string, any>>;

/**
 * Registry of file type processors
 */
export const PROCESSOR_REGISTRY: Record<string, ProcessorComponent> = {
  image: ImageProcessor,
  pdf: PdfProcessor,
  video: VideoProcessor,
  text: TextProcessor,
} as const;

/**
 * Gets the processor component for a given file type
 * @param fileType - The file type ('image', 'pdf', 'video', 'text')
 * @returns The processor component or null if not found
 */
export function getProcessorComponent(
  fileType: string | null
): ProcessorComponent | null {
  if (!fileType) return null;
  return PROCESSOR_REGISTRY[fileType] || null;
}
