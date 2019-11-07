// A decoder for HTML5 character entities and named entities

import { getEntity } from "./entities.js";

type UTF8Array = Uint8Array;
type UTF8Byte = number;
type UTF8Bytes = UTF8Array | [UTF8Byte]

const byte_0: UTF8Byte = "0".charCodeAt(0);
const byte_9: UTF8Byte = "9".charCodeAt(0);
const byte_A: UTF8Byte = "A".charCodeAt(0);
const byte_F: UTF8Byte = "F".charCodeAt(0);
const byte_a: UTF8Byte = "a".charCodeAt(0);
const byte_f: UTF8Byte = "f".charCodeAt(0);

function byteToHexDigit(ch: UTF8Byte): number {
    if (byte_0 <= ch && ch <= byte_9) {
        return ch - byte_0;
    }

    if (byte_A <= ch && ch <= byte_F) {
        return ch - byte_A + 10;
    }

    if (byte_a <= ch && ch <= byte_f) {
        return ch - byte_a + 10;
    }

    return -1;
}

function byteToDecimalDigit(ch: UTF8Byte): number {
    if (byte_0 <= ch && ch <= byte_9) {
        return ch - byte_0;
    }

    return -1;
}

// We store extra data after the string
// Currently the extra data consists of:
// 1. A zero-terminator
const extra: number = 1;

class UTF8String {
    length: number;
    buffer: UTF8Array;

    get capacity() {
        return this.buffer.length - extra;
    }

    constructor(capacity: number = 0) {
        this.length = 0;
        this.buffer = new Uint8Array(capacity ? capacity + extra : 16);
    }

    at(index: number) {
        return this.buffer[index];
    }

    // Ensures that there is at least capacity bytes available.
    // If a new allocation is required, will reserve twice the old capacity or the new capacity, whichever is larger.
    ensureCapacity(capacity: number) {
        if (capacity > this.capacity) {
            const old = this.buffer;
            const realCapacity = capacity + extra;
            const x2 = old.length * 2;
            const buffer = new Uint8Array(Math.max(realCapacity, x2));
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
            const realCapacity = capacity + extra;
            const old = this.buffer;
            const buffer = new Uint8Array(realCapacity);
            buffer.set(old);
            this.buffer = buffer;
        }
        return this;
    }

    resize(length: number) {
        if (length < this.length) {
            this.buffer[length] = 0;
        } else if (this.length < length) {
            this.reserve(length);
            this.buffer.fill(0, this.length);
        }
        this.length = length;
        return this;
    }

    // If there is more space in the storage than is needed to store the text data, copies the data to new storage of exactly the right size
    shrinkToFit() {
        if (this.capacity > this.length) {
            this.buffer = this.buffer.slice(0, this.length + extra);
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
        return this.buffer.subarray(0, this.length + 1); // zero-terminated
    }

    toString() {
        return new TextDecoder().decode(this.value);
    }
}

const lt = new UTF8String().appendString("&lt;");
const gt = new UTF8String().appendString("&gt;");
const amp = new UTF8String().appendString("&amp;");

const byte_lt: UTF8Byte = "<".charCodeAt(0);
const byte_gt: UTF8Byte = ">".charCodeAt(0);
const byte_amp: UTF8Byte = "&".charCodeAt(0);

const byte_hash: UTF8Byte = "#".charCodeAt(0);
const byte_semi: UTF8Byte = ";".charCodeAt(0);
const byte_x: UTF8Byte = "x".charCodeAt(0);
const byte_X: UTF8Byte = "X".charCodeAt(0);

class EntityEncoder {
    text: UTF8String;

    constructor(capacity: number) {
        this.text = new UTF8String(capacity);
    }

    push_back(ch: UTF8Byte) {
        const text = this.text;

        switch (ch) {
            case byte_lt:
                text.append(lt);
                break;
            case byte_gt:
                text.append(gt);
                break;
            case byte_amp:
                text.append(amp);
                break;
            default:
                text.appendBytes([ch]);
        }
    }

    appendBytes(data: UTF8Bytes) {
        for (const ch of data) {
            this.push_back(ch);
        }
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

}

type size_t = number;
type char32_t = number;

const entityMaximumLength = 48; // TODO

/*
 // FROM: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WindowsBestFit/bestfit1252.txt
 0x80	0x20ac	;Euro Sign
 0x81	0x0081
 0x82	0x201a	;Single Low-9 Quotation Mark
 0x83	0x0192	;Latin Small Letter F With Hook
 0x84	0x201e	;Double Low-9 Quotation Mark
 0x85	0x2026	;Horizontal Ellipsis
 0x86	0x2020	;Dagger
 0x87	0x2021	;Double Dagger
 0x88	0x02c6	;Modifier Letter Circumflex Accent
 0x89	0x2030	;Per Mille Sign
 0x8a	0x0160	;Latin Capital Letter S With Caron
 0x8b	0x2039	;Single Left-Pointing Angle Quotation Mark
 0x8c	0x0152	;Latin Capital Ligature Oe
 0x8d	0x008d
 0x8e	0x017d	;Latin Capital Letter Z With Caron
 0x8f	0x008f
 0x90	0x0090
 0x91	0x2018	;Left Single Quotation Mark
 0x92	0x2019	;Right Single Quotation Mark
 0x93	0x201c	;Left Double Quotation Mark
 0x94	0x201d	;Right Double Quotation Mark
 0x95	0x2022	;Bullet
 0x96	0x2013	;En Dash
 0x97	0x2014	;Em Dash
 0x98	0x02dc	;Small Tilde
 0x99	0x2122	;Trade Mark Sign
 0x9a	0x0161	;Latin Small Letter S With Caron
 0x9b	0x203a	;Single Right-Pointing Angle Quotation Mark
 0x9c	0x0153	;Latin Small Ligature Oe
 0x9d	0x009d
 0x9e	0x017e	;Latin Small Letter Z With Caron
 0x9f	0x0178	;Latin Capital Letter Y With Diaeresis
 */

const compatabilityCP1252 = [
    0x20ac,
    0x0081,
    0x201a,
    0x0192,
    0x201e,
    0x2026,
    0x2020,
    0x2021,
    0x02c6,
    0x2030,
    0x0160,
    0x2039,
    0x0152,
    0x008d,
    0x017d,
    0x008f,
    0x0090,
    0x2018,
    0x2019,
    0x201c,
    0x201d,
    0x2022,
    0x2013,
    0x2014,
    0x02dc,
    0x2122,
    0x0161,
    0x203a,
    0x0153,
    0x009d,
    0x017e,
    0x0178,
];

// The basic approach of the entity decoder is to append to the string
// then backtrack once we've seen a possible entity
// If it turns out not to be an entity, the string is unchanged
// Otherwise we replace the entity with the decoded data
// Note that we don't handle named entities without the final semicolon
class EntityDecoder {
    text: UTF8String;

    start: size_t = 0;
    high_start: size_t = 0;
    high_end: size_t = 0;
    high_surrogate: char32_t = 0;

    constructor(capacity: number) {
        this.text = new UTF8String(capacity);
    }

    namedEntity(initial: number) {
        const text = this.text;

        const entity = text.substring(initial - 1).toString(); // Include &
        const data = getEntity(entity);
        
        if (data) {
            text.resize(initial - 1);
            text.appendString(data.characters);
        }
    }

    numericEntity(initial: number) {
        const text = this.text;
        let entity_b = initial + 1;
        const entity_e = text.length - 1;

        let unicode_character: char32_t = 0;
        let success: boolean = false;
        const first = text.at(entity_b);
        if (first == byte_x || first == byte_X) {
            ++entity_b; // Skip X
            // Hex
            if (entity_e - entity_b <= 8) { // max of 8 hex digits
                success = true;
                for (let i = entity_b; i != entity_e; ++i) {
                    const digit = byteToHexDigit(text.at(i));
                    if (digit < 0) {
                        success = false;
                        break;
                    }
                    unicode_character *= 16;
                    unicode_character += digit;
                }
            }
        } else if (entity_b < entity_e) {
            // Decimal
            if (entity_e - entity_b <= 10) { // max of 10 decimal digits
                success = true;
                for (let i = entity_b; i != entity_e; ++i) {
                    const digit = byteToDecimalDigit(text.at(i));
                    if (digit < 0) {
                        success = false;
                        break;
                    }
                    unicode_character *= 10;
                    unicode_character += digit;
                }
            }
        }

        if (success) {
            // Control characters are mapped to useful characters from CP1252
            if (0x80 <= unicode_character && unicode_character <= 0x9f) {
                const index = unicode_character - 0x80;
                unicode_character = compatabilityCP1252[index];
            }

            //assert(initial > 0);

            if (0xD800 <= unicode_character && unicode_character <= 0xDBFF) { // High surrogate
                // A high surrogate will remain encoded unless immediately followed by a low surrogate
                this.high_surrogate = unicode_character;
                this.high_start = initial;
                this.high_end = text.length;
            } else if (0xDC00 <= unicode_character && unicode_character <= 0xDFFF) { // Low surrogate
                // A low surrogate will remain encoded unless immediately preceded by a high surrogate
                if (this.high_start && (initial == this.high_end + 1)) {
                    // http://unicode.org/faq/utf_bom.html#utf16-4
                    const SURROGATE_OFFSET: char32_t = 0x10000 - (0xD800 << 10) - 0xDC00;
                    const codepoint: char32_t = (this.high_surrogate << 10) + unicode_character + SURROGATE_OFFSET;
                    text.resize(this.high_start - 1);
                    text.appendString(String.fromCodePoint(codepoint));
                }
            } else {
                text.resize(initial - 1);
                text.appendString(String.fromCodePoint(unicode_character));
            }
        }
    }

    entity() {
        const text = this.text;
        const initial: size_t = this.start;
        this.start = 0;

        //assert(initial < text.size());
        if (text.length - initial > entityMaximumLength) {
            return;
        }

        if (text.at(initial) === byte_hash) {
            this.numericEntity(initial);
        } else {
            this.namedEntity(initial);
        }
    }

    push_back(ch: UTF8Byte) {
        const text = this.text;
        text.appendBytes([ch]);
        if (ch === byte_amp) {
            this.start = text.length;
        } else if (this.start && ch === byte_semi) {
            this.entity();
        }
    }

    appendBytes(data: UTF8Bytes) {
        for (const ch of data) {
            this.push_back(ch);
        }
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
}

export function decodeEntities(text: string) : string {
    const decoder = new EntityDecoder(text.length);
    decoder.appendString(text);
    return decoder.text.toString();
}