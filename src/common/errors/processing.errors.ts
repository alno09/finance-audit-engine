export class RetryableProcessingError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'RetryableProcessingError';
    }
}

export class PermanentProcessingError extends Error {
    constructor(
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'PermanentProcessingError';
    }
}