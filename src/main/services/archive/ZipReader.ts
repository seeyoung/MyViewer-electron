import yauzl from 'yauzl';
import { ArchiveReader, ArchiveEntry } from './ArchiveReader';
import { promisify } from 'util';
import { Readable } from 'stream';

// 타입 안전한 promisify 버전
const yauzlOpen = (filePath: string, options: yauzl.Options): Promise<yauzl.ZipFile> => {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, options, (err, zipFile) => {
      if (err) reject(err);
      else resolve(zipFile!);
    });
  });
};

/**
 * ZIP Archive Reader
 * Uses yauzl for streaming ZIP extraction
 */
export class ZipReader implements ArchiveReader {
  private zipFile: yauzl.ZipFile | null = null;
  private filePath: string = '';

  async open(filePath: string, password?: string): Promise<void> {
    this.filePath = filePath;

    try {
      // Open ZIP file
      this.zipFile = await yauzlOpen(filePath, {
        lazyEntries: true,
        autoClose: false,
      });
    } catch (error) {
      throw new Error(`Failed to open ZIP archive: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.zipFile) {
      this.zipFile.close();
      this.zipFile = null;
    }
  }

  async listEntries(): Promise<ArchiveEntry[]> {
    console.log('🔧 ZipReader.listEntries() called');
    console.log('📍 Call stack:', new Error().stack?.split('\n').slice(1, 5).join('\n'));
    
    if (!this.zipFile) {
      console.log('❌ ZIP file is not open');
      throw new Error('Archive not open');
    }

    console.log('✅ ZIP file is open, starting entry enumeration...');

    return new Promise((resolve, reject) => {
      const entries: ArchiveEntry[] = [];

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('⏰ ZIP enumeration timeout - resolving with current entries:', entries.length);
        resolve(entries);
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.zipFile!.removeAllListeners('entry');
        this.zipFile!.removeAllListeners('end');
        this.zipFile!.removeAllListeners('error');
      };

      this.zipFile!.on('entry', (entry: yauzl.Entry) => {
        console.log('📄 ZIP entry found:', entry.fileName, entry.fileName.endsWith('/') ? '(DIR)' : '(FILE)');
        
        entries.push({
          path: entry.fileName,
          isDirectory: entry.fileName.endsWith('/'),
          size: entry.uncompressedSize,
          compressedSize: entry.compressedSize,
        });

        // Continue reading
        setImmediate(() => {
          this.zipFile!.readEntry();
        });
      });

      this.zipFile!.on('end', () => {
        console.log('✅ ZIP enumeration complete, total entries:', entries.length);
        cleanup();
        resolve(entries);
      });

      this.zipFile!.on('error', (err: Error) => {
        console.log('❌ ZIP enumeration error:', err.message);
        cleanup();
        reject(new Error(`Failed to list ZIP entries: ${err.message}`));
      });

      // Start reading entries
      console.log('🚀 Starting ZIP entry reading...');
      this.zipFile!.readEntry();
    });
  }

  async extractEntry(entryPath: string): Promise<Buffer> {
    if (!this.zipFile) {
      throw new Error('Archive not open');
    }

    // Re-open the ZIP file for extraction
    const zipFile = await yauzlOpen(this.filePath, {
      lazyEntries: true,
      autoClose: false,
    });

    return new Promise((resolve, reject) => {
      zipFile.readEntry();

      zipFile.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName === entryPath) {
          // Found the entry
          zipFile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipFile.close();
              reject(new Error(`Failed to open entry stream: ${err.message}`));
              return;
            }

            const chunks: Buffer[] = [];
            readStream!.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });

            readStream!.on('end', () => {
              zipFile.close();
              resolve(Buffer.concat(chunks));
            });

            readStream!.on('error', (error: Error) => {
              zipFile.close();
              reject(new Error(`Failed to read entry: ${error.message}`));
            });
          });
        } else {
          zipFile.readEntry();
        }
      });

      zipFile.on('end', () => {
        zipFile.close();
        reject(new Error(`Entry not found: ${entryPath}`));
      });

      zipFile.on('error', (err: Error) => {
        zipFile.close();
        reject(new Error(`Failed to extract entry: ${err.message}`));
      });
    });
  }

  async isPasswordProtected(): Promise<boolean> {
    // yauzl doesn't directly support encrypted ZIPs
    // We detect encryption by checking entries
    if (!this.zipFile) {
      return false;
    }

    // Don't call listEntries() here to avoid duplicate enumeration
    // For now, return false (encryption detection can be enhanced later)
    console.log('🔒 Password protection check (skipped to avoid duplicate enumeration)');
    return false;
  }
}
