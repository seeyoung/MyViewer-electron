// Use system unrar command
import { ArchiveReader, ArchiveEntry } from './ArchiveReader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * RAR Archive Reader
 * Uses system unar command
 */
export class RarReader implements ArchiveReader {
  private filePath: string = '';
  private password: string | undefined;
  private tempDir: string = '';

  async open(filePath: string, password?: string): Promise<void> {
    this.filePath = filePath;
    this.password = password;

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`RAR file not found: ${filePath}`);
    }

    // Create temporary directory for extraction
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rar-extract-'));
    console.log(`🔧 Created temp directory: ${this.tempDir}`);
  }

  async close(): Promise<void> {
    // Cleanup temporary directory
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temp directory: ${this.tempDir}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup temp directory: ${error}`);
      }
    }
    this.filePath = '';
    this.password = undefined;
    this.tempDir = '';
  }

  async listEntries(): Promise<ArchiveEntry[]> {
    if (!this.filePath) {
      throw new Error('Archive not open');
    }

    console.log(`🔧 RAR listEntries called for: ${this.filePath}`);

    try {
      // Use unar command to list archive contents
      const args = [this.filePath];
      if (this.password) {
        args.push('-password', this.password);
      }

      console.log(`📋 Running lsar with args:`, args);

      const { stdout, stderr } = await execFileAsync('lsar', args);

      if (stderr && stderr.includes('password')) {
        console.log(`🔒 Password required for RAR archive`);
        throw new Error('PASSWORD_REQUIRED');
      }

      console.log(`📁 Raw lsar output received, parsing...`);

      const entries: ArchiveEntry[] = [];
      const lines = stdout.split('\n');

      // lsar output format is simply one filename per line after the first line (which contains archive info)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip the first line which contains archive format info
        if (i === 0) {
          continue;
        }

        // Parse each file entry line
        const trimmed = line.trim();
        if (!trimmed || trimmed.length === 0) {
          continue;
        }

        // The line is just the filename/path
        const fileName = trimmed;

        entries.push({
          path: fileName,
          isDirectory: fileName.endsWith('/'),
          size: 0, // lsar doesn't provide size info in simple mode
          compressedSize: 0,
        });
      }

      console.log(`✅ RAR entries listed successfully: ${entries.length} entries`);
      return entries;
    } catch (error) {
      console.log(`❌ RAR listEntries error:`, error);

      if (error instanceof Error && (error.message.includes('password') || error.message.includes('PASSWORD_REQUIRED'))) {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw new Error(`Failed to list RAR entries: ${error}`);
    }
  }

  async extractEntry(entryPath: string): Promise<Buffer> {
    if (!this.filePath) {
      throw new Error('Archive not open');
    }

    console.log(`🔧 RAR extractEntry called for: ${entryPath}`);

    try {
      // Clean temp directory first
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(this.tempDir, { recursive: true });

      const args = [
        this.filePath,
        '-output-directory', this.tempDir,
        '-no-directory'
      ];

      if (this.password) {
        args.push('-password', this.password);
      }

      // Note: unar doesn't support extracting a single file easily by path in all versions/formats without extracting everything or using complex filters.
      // However, we can try to pass the file path as an argument if supported, or we might have to extract all (inefficient).
      // For now, we'll try to extract just the file if possible, but unar syntax for single file is just appending it.
      // But wait, unar extracts the whole archive by default.
      // To extract specific file: unar archive.rar file_to_extract.txt
      args.push(entryPath);

      console.log(`📦 Running unar with args:`, args);

      const { stdout, stderr } = await execFileAsync('unar', args);

      if (stderr && stderr.includes('password')) {
        console.log(`🔒 Password required for RAR archive`);
        throw new Error('PASSWORD_REQUIRED');
      }

      console.log(`📁 Extraction completed, searching for file: ${entryPath}`);

      // Find the extracted file
      const findFile = (dir: string, targetPath: string): string | null => {
        try {
          const files = fs.readdirSync(dir, { withFileTypes: true });

          for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory()) {
              const found = findFile(fullPath, targetPath);
              if (found) return found;
            } else {
              // Check if this is our target file by comparing the path
              const relativePath = path.relative(this.tempDir, fullPath);
              // Normalize paths for comparison
              if (path.normalize(relativePath) === path.normalize(targetPath) || file.name === path.basename(targetPath)) {
                return fullPath;
              }
            }
          }
        } catch (error) {
          console.log(`❌ Error searching directory ${dir}:`, error);
        }

        return null;
      };

      const extractedFilePath = findFile(this.tempDir, entryPath);

      if (!extractedFilePath || !fs.existsSync(extractedFilePath)) {
        throw new Error(`Extracted file not found: ${entryPath}`);
      }

      // Read the extracted file
      const buffer = fs.readFileSync(extractedFilePath);
      console.log(`✅ RAR file extracted successfully, buffer size: ${buffer.length} bytes`);

      return buffer;

    } catch (error) {
      console.log(`❌ RAR extraction error:`, error);

      if (error instanceof Error && (error.message.includes('password') || error.message.includes('PASSWORD_REQUIRED'))) {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw new Error(`Failed to extract RAR entry: ${error}`);
    }
  }

  async isPasswordProtected(): Promise<boolean> {
    if (!this.filePath) {
      return false;
    }

    try {
      const args = [this.filePath];
      console.log(`🔒 Checking password protection with lsar`);

      const { stdout, stderr } = await execFileAsync('lsar', args);

      if (stderr && (stderr.includes('password') || stderr.includes('encrypted'))) {
        console.log(`🔒 Archive is password protected`);
        return true;
      }

      return false;
    } catch (error) {
      console.log(`🔒 Password protection check error:`, error);

      if (error instanceof Error && (error.message.includes('password') || error.message.includes('encrypted') || error.message.includes('wrong password'))) {
        console.log(`🔒 Archive is password protected`);
        return true;
      }

      return false;
    }
  }
}
