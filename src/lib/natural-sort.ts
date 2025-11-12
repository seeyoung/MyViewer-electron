/**
 * Natural alphanumeric sorting
 * Sorts filenames correctly: file1.jpg, file2.jpg, file10.jpg, file20.jpg
 * Instead of: file1.jpg, file10.jpg, file2.jpg, file20.jpg
 */

export function naturalSort(a: string, b: string): number {
  // Regular expression to split strings into numeric and non-numeric parts
  const re = /(\d+)|(\D+)/g;

  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];

  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';

    // Check if both parts are numeric
    const aIsNum = /^\d+$/.test(aPart);
    const bIsNum = /^\d+$/.test(bPart);

    if (aIsNum && bIsNum) {
      // Compare as numbers
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      // Compare as strings (case-insensitive)
      const comparison = aPart.localeCompare(bPart, undefined, {
        sensitivity: 'base',
      });
      if (comparison !== 0) {
        return comparison;
      }
    }
  }

  return 0;
}

/**
 * Sort an array of strings using natural sorting
 */
export function naturalSortArray(arr: string[]): string[] {
  return [...arr].sort(naturalSort);
}

/**
 * Sort an array of objects by a string property using natural sorting
 */
export function naturalSortBy<T>(arr: T[], key: keyof T): T[] {
  return [...arr].sort((a, b) => {
    const aVal = String(a[key]);
    const bVal = String(b[key]);
    return naturalSort(aVal, bVal);
  });
}
