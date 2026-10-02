import {
  Global,
  Module,
} from '@nestjs/common';

import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';

@Global()
@Module({
  providers: [
    LocalStorageService,
    {
      provide: StorageService,
      useExisting: LocalStorageService,
    },
  ],
  exports: [
    StorageService,
  ],
})
export class StorageModule {}