/**
 * Base types for file processors
 */

export interface BaseProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

export interface ProcessorMetadata {
  file_size: number;
  file_created?: string;
  file_modified?: string;
}

export interface MetadataEntry {
  key: string;
  value: string;
}
