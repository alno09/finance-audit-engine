# HTTP API

Base URL during local development: `http://localhost:3000`

The API has no authentication at present. Responses use JSON except for the multipart upload request.

## Upload a document

```http
POST /documents
Content-Type: multipart/form-data
```

The multipart field must be named `file`.

### Constraints

- Maximum size: 10 MB
- Accepted MIME types: `application/pdf`, `image/jpeg`, `image/png`
- Documents are deduplicated by SHA-256 content hash

Although images are accepted at upload time, the current processing worker uses PDF text extraction and does not yet invoke OCR. Use text-based PDF invoices for the complete pipeline.

### Example

```bash
curl -X POST http://localhost:3000/documents \
  -F "file=@/absolute/path/to/invoice.pdf"
```

### Successful response

The response is the newly created `Document` record. A repeated upload with the same content returns the existing record instead.

```json
{
  "id": "cm...",
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "sha256": "...",
  "storageKey": "f8a1...pdf",
  "status": "UPLOADED",
  "errorMessage": null,
  "createdAt": "2026-10-01T00:00:00.000Z",
  "updatedAt": "2026-10-01T00:00:00.000Z"
}
```

The status changes asynchronously after this response. Poll the detail endpoint for progress and results.

### Validation errors

| Condition                     | Result                                    |
| ----------------------------- | ----------------------------------------- |
| Missing `file` field          | `400 Bad Request`                         |
| Unsupported MIME type         | `400 Bad Request`                         |
| File exceeds the Multer limit | Upload rejected before service processing |

## Get a document and its result

```http
GET /documents/:id
```

Returns the document plus all currently available processing data:

- `extraction`: extracted raw text and metadata
- `invoice`: structured invoice fields
- `invoice.lineItems`: extracted line items
- `invoice.audit`: audit status
- `invoice.audit.findings`: detailed audit findings

### Example

```bash
curl http://localhost:3000/documents/cm123
```

### Response shape

```json
{
  "id": "cm123",
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "status": "APPROVED",
  "errorMessage": null,
  "extraction": {
    "method": "PDF_TEXT",
    "rawText": "...",
    "characterCount": 1420
  },
  "invoice": {
    "invoiceNumber": "INV-1001",
    "vendorName": "Example Vendor",
    "currency": "IDR",
    "subtotal": "100000",
    "tax": "11000",
    "total": "111000",
    "lineItems": [],
    "audit": {
      "status": "PASSED",
      "findings": []
    }
  }
}
```

Relations that have not been created yet are returned as `null` or empty arrays according to the Prisma relation shape.

### Not found

An unknown ID returns `404 Not Found` with a message in this form:

```json
{
  "statusCode": 404,
  "message": "Document cm123 not found",
  "error": "Not Found"
}
```

## Status interpretation

| Status              | Meaning                                                   |
| ------------------- | --------------------------------------------------------- |
| `UPLOADED`          | File and initial database record were created             |
| `QUEUED`            | The outbox event was published to BullMQ                  |
| `EXTRACTING`        | Worker is reading, extracting, or structuring the invoice |
| `AUDITING`          | Structured invoice data is being audited                  |
| `APPROVED`          | Audit completed with no error findings                    |
| `NEEDS_REVIEW`      | Audit produced one or more error findings                 |
| `EXTRACTION_FAILED` | Processing permanently failed or exhausted retries        |

See [Architecture](architecture.md) for retry and state-transition details.
