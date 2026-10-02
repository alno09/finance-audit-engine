import {
  Global,
  Module,
} from '@nestjs/common';

import { InvoiceAiProvider } from './invoice-ai.provider';
import { GeminiInvoiceProvider } from './gemini-invoice.provider';

@Global()
@Module({
  providers: [
    GeminiInvoiceProvider,

    {
      provide: InvoiceAiProvider,
      useExisting: GeminiInvoiceProvider,
    },
  ],

  exports: [
    InvoiceAiProvider,
  ],
})
export class AiModule {}