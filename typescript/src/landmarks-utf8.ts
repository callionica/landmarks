export type UTF8Array = Uint8Array;
export type UTF8Byte = number;
export type UTF8Bytes = UTF8Array | [UTF8Byte]

export function u8(text: string) : UTF8Array {
    return new TextEncoder().encode(text);
}

export class UTF8String {
    private _length: number;
    private _buffer: UTF8Array;

    get capacity() {
        return this._buffer.length;
    }

    get length() {
        return this._length;
    }

    // Attach a buffer (if length is not supplied, buffer is assumed to be full)
    constructor(buffer: UTF8Array, length?: number)
    // Copy a string
    constructor(text: string)
    // Create a new empty buffer
    constructor(capacity?: number)
    constructor(first: any, length?: number) {
        if (typeof first === "object") {
            const buffer = first as UTF8Array;
            if (length === undefined) {
                length = buffer.length;
            }
            this._buffer = buffer;
            this._length = length;
        } else if (typeof first === "string") {
            const text = first as string;
            this._length = 0;
            this._buffer = new Uint8Array(text.length);
            this.appendString(text);
        } else {
            const capacity = first as number;
            this._length = 0;
            this._buffer = new Uint8Array(capacity ? capacity : 16);
        }
    }

    attach(buffer: UTF8Array, length?: number) {
        if (length === undefined) {
            length = buffer.length;
        }
        this._buffer = buffer;
        this._length = length;
        return this;
    }

    at(index: number): UTF8Byte {
        return this._buffer[index];
    }

    // Ensures that there is at least capacity bytes available.
    // If a new allocation is required, will reserve twice the old capacity or the new capacity, whichever is larger.
    private ensureCapacity(capacity: number) {
        if (capacity > this.capacity) {
            const old = this._buffer;
            const x2 = old.length * 2;
            const buffer = new Uint8Array(Math.max(capacity, x2));
            buffer.set(old);
            this._buffer = buffer;
        }
    }

    appendBytes(data: UTF8Bytes) {
        this.ensureCapacity(this._length + data.length);
        this._buffer.set(data, this._length);
        this._length += data.length;
        this._buffer[this._length] = 0;
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
            const old = this._buffer;
            const buffer = new Uint8Array(capacity);
            buffer.set(old);
            this._buffer = buffer;
        }
        return this;
    }

    // If resize causes an allocation, it uses reserve
    resize(length: number) {
        if (length == this._length) {
            return;
        }

        if (length < this._length) {
            // Zeroes from new length to old length
            this._buffer.fill(0, length, this._length);
        } else if (this._length < length) {
            this.reserve(length);
            // Javascript typed arrays are zero-initialized
            // so no need to fill with zeroes here
        }

        this._length = length;
        return this;
    }

    // If there is more space in the storage than is needed to store the text data, copies the data to new storage of exactly the right size
    shrinkToFit() {
        if (this.capacity > this._length) {
            this._buffer = this._buffer.slice(0, this._length);
        }
        return this;
    }

    // Returns a copy of the requested section of the data
    substring(begin: number, end?: number | undefined): UTF8String {
        if (end === undefined) {
            end = this._length;
        } else if (end < 0) {
            end = this._length + end;
        }
        const view = this._buffer.subarray(begin, end);
        return new UTF8String(view.length).appendBytes(view);
    }

    // Returns a view of the data
    get value(): UTF8Array {
        return this._buffer.subarray(0, this._length);
    }

    // Returns a view of the data with a zero-terminator
    // This will cause an allocation & copy if the buffer doesn't have room for a zero terminator, but the allocation will not be larger than necessary
    c_str(): UTF8Array {
        // Unused space is always zeroed
        this.reserve(this._length + 1);
        return this._buffer.subarray(0, this._length + 1);
    }

    // Returns a JS string of the data
    toString() {
        return new TextDecoder().decode(this.value);
    }
}
