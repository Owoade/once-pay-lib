/**
 * Once-Pay Vanilla JS SDK
 *
 * Wraps the merchant-api endpoint of once-pay-be:
 *   POST /transaction/initiate
 *
 * Auth is the merchant API key (`pk_<key_id>_<secret>`) as a Bearer token.
 * After initiating, the SDK can listen on the backend's Socket.IO
 * `/transactions` namespace and invoke a callback when the backend broadcasts
 * `{ reference }` for that transaction.
 *
 * socket.io-client is loaded automatically: the `socket.io-client` package when
 * running under Node/bundlers, otherwise from the jsDelivr CDN in the browser.
 *
 * No other dependencies; uses the global `fetch` (browsers and Node 18+).
 */


const DEFAULT_BASE_URL = "https://backpack-trailside-unraveled.ngrok-free.dev";
const SOCKET_IO_CDN_URL = "https://cdn.jsdelivr.net/npm/socket.io-client@4.8.4/dist/socket.io.esm.min.js";

// Error thrown for every failed call. `code` is the backend status code.
class OncePayError extends Error {
    constructor(message, code = 500, response = null) {
        super(message);
        this.name = "OncePayError";
        this.code = code;
        this.response = response;
    }
}

class OncePay {
    constructor({ base_url, api_key } = {}) {
        this.base_url = (base_url || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.api_key = api_key;

        if (!this.api_key) {
            throw new OncePayError("api_key is required — pass the merchant API key (pk_...)");
        }

        this.transaction_io = null;                       // lazy socket connection
        this.pending_transaction_callbacks = new Map();   // reference → callback
    }

   
    async initiate_transaction(payload = {}) {
        const { amount, email, payment_gateway, on_success } = payload;

        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            throw new OncePayError("amount must be a positive number", 400);
        }
        if (!email) {
            throw new OncePayError("email is required", 400);
        }
        if (!payment_gateway) {
            throw new OncePayError("payment_gateway is required", 400);
        }

        const body = { amount, email, payment_gateway };

        if (payload.callback_url) body.callback_url = payload.callback_url;
        if (payload.metadata) body.metadata = payload.metadata;

        // on_success is a local option, never sent to the API.
        const response = await this.post("/transaction/initiate", body);

        const reference = response?.data?.transaction_reference;
        if (on_success && reference) {
            this.watch_transaction(reference, on_success).catch((error) => {
                console.warn("Once-Pay: could not listen for transaction events:", error.message);
            });
        }

        return response;
    }

    watch_transaction(reference, callback) {
        this.pending_transaction_callbacks.set(reference, callback);
        return this.ensure_transaction_socket();
    }

    async ensure_transaction_socket() {
        if (this.transaction_io) return; // already connecting/connected

        const { io } = await this.load_socket_io();
        this.transaction_io = io(`${this.base_url}/transactions`);

        this.transaction_io.on("transaction", (payload) => this.handle_transaction_event(payload));
    }

    async load_socket_io() {
        try {
            return await import("socket.io-client"); // Node / bundler resolution
        } catch (error) {
            // Not installed as a package.
        }

        if (typeof window !== "undefined") {
            return await import(SOCKET_IO_CDN_URL);
        }

        throw new OncePayError(
            "socket.io-client is required to listen for transaction events — npm install socket.io-client (or run in a browser)"
        );
    }

    handle_transaction_event(payload) {
        const reference = payload?.reference;
        const callback = this.pending_transaction_callbacks.get(reference);
        if (!callback) return; // Not one of ours, or already fired — ignore.

        // The entry is consumed before the callback runs: the backend may
        // broadcast the same reference more than once (a webhook and a verify
        // sync can both emit), and duplicates must never re-fire it.
        this.pending_transaction_callbacks.delete(reference);
        callback(payload);

        // Nothing else is being watched — close the connection.
        if (this.pending_transaction_callbacks.size === 0) {
            this.transaction_io?.disconnect();
            this.transaction_io = null;
        }
    }

    async post(path, body) {
        const config = {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.api_key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        };

        let response;
        try {
            response = await fetch(`${this.base_url}${path}`, config);
        } catch (network_error) {
            throw new OncePayError(`Could not reach Once-Pay at ${this.base_url}`, 0, null);
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            // Unparseable body — fall back to a generic error below.
        }

        // The backend envelope is { status, message, data, current_time }.
        if (!response.ok || payload?.status === "error") {
            throw new OncePayError(
                payload?.message || `Request failed with status ${response.status}`,
                response.status,
                payload
            );
        }

        return payload;
    }
}
