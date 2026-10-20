export type PaymentGateway = "flutterwave" | "paystack" | "korapay" | "monnify" | "seerbit";

export interface OncePayOptions {
    /** Once-Pay backend base URL, e.g. "https://api.oncepay.example". */
    base_url?: string;
    /** Merchant API key: "pk_<key_id>_<secret>". */
    api_key: string;
}

export interface TransactionEventPayload {
    reference: string;
}

export interface InitiateTransactionPayload {
    amount: number;
    email: string;
    payment_gateway: PaymentGateway;
    /** URL the shopper's browser is sent to after the gateway callback. */
    callback_url?: string;
    metadata?: Record<string, unknown>;
    /**
     * Invoked at most once, with the `{ reference }` payload the backend
     * broadcasts on the Socket.IO /transactions namespace when this
     * transaction settles.
     */
    on_success?: (payload: TransactionEventPayload) => void;
}

export interface InitiateTransactionData {
    payment_link: string;
    transaction_reference: string;
}

/** The backend's standard response envelope. */
export interface OncePayEnvelope<T> {
    status: "success" | "error";
    message: string;
    data: T | null;
    current_time: string;
}

/** Thrown for every failed call. `code` is the backend status code. */
export declare class OncePayError extends Error {
    /** Backend status code (or 0 on network failure). */
    code: number;
    /** Raw envelope, when the server responded with one. */
    response: OncePayEnvelope<unknown> | null;
}

export declare class OncePay {
    constructor(options?: OncePayOptions);
    initiate_transaction(payload: InitiateTransactionPayload): Promise<OncePayEnvelope<InitiateTransactionData>>;
    /**
     * Listen for a transaction's settlement on the backend's Socket.IO
     * /transactions namespace. Fires the callback at most once.
     */
    watch_transaction(reference: string, callback: (payload: TransactionEventPayload) => void): Promise<void>;
}

declare const once_pay_default: typeof OncePay;
export default once_pay_default;