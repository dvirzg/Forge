import { useCallback } from 'react';
import { formatFileSize } from '../utils/fileUtils';
import type { MetadataEntry } from '../types/processor';

interface BaseMetadata {
  file_size: number;
  file_created?: string;
  file_modified?: string;
}

interface UseMetadataOptions<T extends BaseMetadata> {
  metadata: T | null;
  getBasicEntries: (meta: T) => MetadataEntry[];
  getExtendedEntries?: (meta: T) => MetadataEntry[];
}

/**
 * Hook for managing metadata display logic
 */
export function useMetadata<T extends BaseMetadata>({
  metadata,
  getBasicEntries,
  getExtendedEntries,
}: UseMetadataOptions<T>) {
  const getBasicMetadataEntries = useCallback((): MetadataEntry[] => {
    if (!metadata) return [];
    return getBasicEntries(metadata);
  }, [metadata, getBasicEntries]);

  const getAllMetadataEntries = useCallback((): MetadataEntry[] => {
    if (!metadata) return [];
    const basic = getBasicEntries(metadata);
    const extended = getExtendedEntries ? getExtendedEntries(metadata) : [];
    return [...basic, ...extended];
  }, [metadata, getBasicEntries, getExtendedEntries]);

  const hasExtendedMetadata = useCallback((): boolean => {
    if (!metadata || !getExtendedEntries) return false;
    const extended = getExtendedEntries(metadata);
    return extended.length > 0;
  }, [metadata, getExtendedEntries]);

  return {
    getBasicMetadataEntries,
    getAllMetadataEntries,
    hasExtendedMetadata,
  };
}

/**
 * Helper to format file size in metadata entries
 */
export function formatFileSizeEntry(bytes: number): string {
  return formatFileSize(bytes);
}
