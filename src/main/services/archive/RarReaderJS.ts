// node-unrar-js는 CommonJS 방식으로 import
const { createExtractorFromData, createExtractorFromFile } = require('node-unrar-js');
import { ArchiveReader, ArchiveEntry } from './ArchiveReader';
import * as fs from 'fs';

/**
 * RAR Archive Reader - JavaScript/WebAssembly Implementation
 * Uses node-unrar-js (pure JavaScript, no system dependencies)
 */
export class RarReaderJS implements ArchiveReader {
  private filePath: string = '';
  private password: string | undefined;
  private extractor: any = null;

  async open(filePath: string, password?: string): Promise<void> {
    this.filePath = filePath;
    this.password = password;

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`RAR file not found: ${filePath}`);
    }

    try {
      // Create extractor from file
      this.extractor = await createExtractorFromFile({
        filepath: this.filePath,
        targetPath: '', // Empty means in-memory extraction
        password: this.password,
      });

      console.log(`✅ JavaScript RAR extractor created for: ${filePath}`);
    } catch (error) {
      console.log(`❌ Failed to create RAR extractor:`, error);
      throw new Error(`Failed to open RAR archive: ${error}`);
    }
  }

  async close(): Promise<void> {
    // No explicit cleanup needed for node-unrar-js
    this.extractor = null;
    this.filePath = '';
    this.password = undefined;
  }

  async listEntries(): Promise<ArchiveEntry[]> {
    if (!this.extractor) {
      throw new Error('Archive not open');
    }

    console.log(`🔧 JS RAR listEntries called for: ${this.filePath}`);

    try {
      // Extract file list using the generator approach
      const extracted = this.extractor.extract();
      
      if (!extracted || !extracted.files) {
        throw new Error('Failed to extract file list from RAR archive');
      }

      // Convert generator to array
      const filesArray = Array.from(extracted.files);
      console.log(`📁 Found ${filesArray.length} entries in JavaScript RAR archive`);

      const entries: ArchiveEntry[] = [];

      for (const file of filesArray) {
        const header = (file as any).fileHeader;
        if (!header) continue;

        entries.push({
          path: header.name,
          isDirectory: header.flags?.directory || false,
          size: header.unpSize || 0,
          compressedSize: header.packSize || 0,
        });

        console.log(`  📄 ${header.name} (${header.unpSize} bytes)`);
      }

      console.log(`✅ JS RAR entries listed successfully: ${entries.length} entries`);
      return entries;
    } catch (error) {
      console.log(`❌ JS RAR listEntries error:`, error);
      
      if (error instanceof Error && (error.message.includes('password') || error.message.includes('encrypted'))) {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw new Error(`Failed to list RAR entries: ${error}`);
    }
  }

  async extractEntry(entryPath: string): Promise<Buffer> {
    if (!this.filePath) {
      throw new Error('Archive not open');
    }

    console.log(`🔧 JS RAR extractEntry called for: ${entryPath} (using correct API)`);

    try {
      // Use the correct API pattern from official docs
      // Read RAR file into buffer and use createExtractorFromData
      const rarBuffer = fs.readFileSync(this.filePath);
      const uint8Buffer = Uint8Array.from(rarBuffer).buffer;
      
      console.log(`📁 Loaded RAR file into memory: ${rarBuffer.length} bytes`);

      // Create extractor from data (not file)
      const extractor = await createExtractorFromData({ 
        data: uint8Buffer,
        password: this.password 
      });

      console.log(`✅ Created extractor from data`);

      // Get file list first
      const list = extractor.getFileList();
      const fileHeaders = [...list.fileHeaders];
      
      console.log(`📋 Got ${fileHeaders.length} file headers`);

      // Find our target file in the list
      const targetHeader = fileHeaders.find((header: any) => 
        header.name === entryPath
      );

      if (!targetHeader) {
        console.log(`❌ File not found in headers: ${entryPath}`);
        console.log(`📋 Available files: ${fileHeaders.slice(0, 5).map((h: any) => h.name).join(', ')}`);
        throw new Error(`Entry not found: ${entryPath}`);
      }

      console.log(`✅ Found target file header: ${targetHeader.name}`);

      // Extract specific file using the correct API
      const extracted = extractor.extract({ files: [entryPath] });
      const files = [...extracted.files];

      if (files.length === 0) {
        console.log(`❌ No files extracted for: ${entryPath}`);
        throw new Error(`Failed to extract file: ${entryPath}`);
      }

      const file = files[0];
      console.log(`📦 Extracted file object keys:`, Object.keys(file));

      // Check for extraction data
      if (file.extraction && file.extraction.length > 0) {
        const buffer = Buffer.from(file.extraction);
        console.log(`✅ JS RAR file extracted successfully using correct API, buffer size: ${buffer.length} bytes`);
        return buffer;
      } else {
        console.log(`❌ No extraction data in file object`);
        console.log(`🔧 Full file object:`, JSON.stringify(file, null, 2));
        throw new Error(`No extraction data for file: ${entryPath}`);
      }

    } catch (error) {
      console.log(`❌ JS RAR extraction error:`, error);
      
      if (error instanceof Error && (error.message.includes('password') || error.message.includes('encrypted'))) {
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
      // Try to create extractor without password
      const testExtractor = await createExtractorFromFile({
        filepath: this.filePath,
        targetPath: '',
      });
      
      // Try to extract file list
      const extracted = testExtractor.extract();
      const filesArray = Array.from(extracted.files);
      
      console.log(`🔒 JS RAR archive check: ${filesArray.length} files found, not password protected`);
      return false;
    } catch (error) {
      console.log(`🔒 JS RAR password protection check error:`, error);
      
      if (error instanceof Error && (error.message.includes('password') || error.message.includes('encrypted') || error.message.includes('wrong password'))) {
        console.log(`🔒 JS RAR archive is password protected`);
        return true;
      }
      
      // For other errors, assume not password protected
      console.log(`🔒 JS RAR archive check: assuming not password protected due to other error`);
      return false;
    }
  }
}