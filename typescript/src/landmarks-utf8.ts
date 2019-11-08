export type UTF8Array = Uint8Array;
export type UTF8Byte = number;
export type UTF8Bytes = UTF8Array | [UTF8Byte]

export class UTF8String {
    length: number;
    buffer: UTF8Array;

    get capacity() {
        return this.buffer.length;
    }

    constructor(buffer: UTF8Array, length?: number)
    constructor(text: string)
    constructor(capacity?: number)
    constructor(first: any, length?: number) {
        if (typeof first === "object") {
            const buffer = first as UTF8Array;
            if (length === undefined) {
                length = buffer.length;
            }
            this.buffer = buffer;
            this.length = length;
            return;
        } else if (typeof first === "string") {
            const text = first as string;
            this.length = 0;
            this.buffer = new Uint8Array(text.length);
            this.appendString(text);
            return;
        }

        const capacity = first as number;
        this.length = 0;
        this.buffer = new Uint8Array(capacity ? capacity : 16);
    }

    attach(buffer: UTF8Array, length?: number) {
        if (length === undefined) {
            length = buffer.length;
        }
        this.buffer = buffer;
        this.length = length;
        return this;
    }

    at(index: number) : UTF8Byte {
        return this.buffer[index];
    }

    // Ensures that there is at least capacity bytes available.
    // If a new allocation is required, will reserve twice the old capacity or the new capacity, whichever is larger.
    ensureCapacity(capacity: number) {
        if (capacity > this.capacity) {
            const old = this.buffer;
            const x2 = old.length * 2;
            const buffer = new Uint8Array(Math.max(capacity, x2));
            buffer.set(old);
            this.buffer = buffer;
        }
    }

    appendBytes(data: UTF8Bytes) {
        this.ensureCapacity(this.length + data.length);
        this.buffer.set(data, this.length);
        this.length += data.length;
        this.buffer[this.length] = 0;
        return this;
    }

    appendString(text: string) {
        const data = new TextEncoder().encode(text);
        return this.appendBytes(data);
    }

    append(text: UTF8String) {
        const data = text.value;
        return this.appendBytes(data);
    }

    // Ensures that there is at least capacity bytes available.
    // If a new allocation is required, will reserve capacity bytes.
    reserve(capacity: number) {
        if (capacity > this.capacity) {
            const old = this.buffer;
            const buffer = new Uint8Array(capacity);
            buffer.set(old);
            this.buffer = buffer;
        }
        return this;
    }

    resize(length: number) {
        if (length == this.length) {
            return;
        }

        if (length < this.length) {
            // Zeroes from new length to old length
            this.buffer.fill(0, length, this.length);
        } else if (this.length < length) {
            this.reserve(length);
            // Javascript typed arrays are zero-initialized
            // so no need to initialize here
        }

        this.length = length;
        return this;
    }

    // If there is more space in the storage than is needed to store the text data, copies the data to new storage of exactly the right size
    shrinkToFit() {
        if (this.capacity > this.length) {
            this.buffer = this.buffer.slice(0, this.length);
        }
        return this;
    }

    substring(begin: number, end?: number | undefined): UTF8String {
        if (end === undefined) {
            end = this.length;
        } else if (end < 0) {
            end = this.length + end;
        }
        const view = this.buffer.subarray(begin, end);
        return new UTF8String(view.length).appendBytes(view);
    }

    // Returns a view of the data
    get value(): UTF8Array {
        return this.buffer.subarray(0, this.length);
    }

    // Returns a view of the data with the zero-terminator
    get c_str(): UTF8Array {
        this.ensureCapacity(this.length + 1);
        this.buffer[this.length] = 0;
        return this.buffer.subarray(0, this.length + 1); // zero-terminated
    }

    toString() {
        return new TextDecoder().decode(this.value);
    }
}
