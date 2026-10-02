import {
  Injectable,
} from '@nestjs/common';

import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';

import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { StorageService } from './storage.service';

@Injectable()
export class LocalStorageService
  extends StorageService
{
  private readonly basePath = join(
    process.cwd(),
    'storage',
    'documents',
  );

  async save(
    file: Express.Multer.File,
  ): Promise<string> {
    await mkdir(this.basePath, {
      recursive: true,
    });

    const extension =
      this.getExtension(file.originalname);

    const filename =
      extension.length > 0
        ? `${randomUUID()}.${extension}`
        : randomUUID();

    const fullPath = join(
      this.basePath,
      filename,
    );

    await writeFile(
      fullPath,
      file.buffer,
    );

    return filename;
  }

  async read(
    storageKey: string,
  ): Promise<Buffer> {
    const fullPath = join(
      this.basePath,
      storageKey,
    );

    return readFile(fullPath);
  }

  async delete(
    storageKey: string,
  ): Promise<void> {
    const fullPath = join(
      this.basePath,
      storageKey,
    );

    await unlink(fullPath);
  }

  private getExtension(
    filename: string,
  ): string {
    const parts = filename.split('.');

    if (parts.length < 2) {
      return '';
    }

    return parts.at(-1)?.toLowerCase() ?? '';
  }
}