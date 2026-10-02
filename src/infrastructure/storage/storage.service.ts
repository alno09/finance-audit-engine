import { Injectable } from '@nestjs/common';

export abstract class StorageService {
    abstract save(
        file: Express.Multer.File,
    ): Promise<string>;

    abstract read(
        storageKey: string,
    ): Promise<Buffer>;

    abstract delete(
        storageKey: string,
    ): Promise<void>;
}