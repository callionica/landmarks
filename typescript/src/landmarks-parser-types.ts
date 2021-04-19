// ALL RIGHTS RESERVED

import { decodeEntities } from "./landmarks-entities.ts";

export type LandmarksPosition = number;

// The parsing code assumes that npos is a large positive integer
export const npos: LandmarksPosition = Number.MAX_SAFE_INTEGER;

export const enum EndTagState {
    unmatched = "unmatched", // No matching start tag
    matched = "matched", // Matching start tag
    autoclosedByParent = "autoclosedByParent", // Closed when parent closed (or EOF)
    autoclosedBySibling = "autoclosedBySibling", // Closed when specific sibling opened
    autoclosedByAncestor = "autoclosedByAncestor", // Closed when specific ancestor closed
};

export function isAutoclosed(state: EndTagState): boolean {
    switch (state) {
        case EndTagState.unmatched: // fallthrough
        case EndTagState.matched:
            return false;
        case EndTagState.autoclosedByParent: // fallthrough
        case EndTagState.autoclosedBySibling: // fallthrough
        case EndTagState.autoclosedByAncestor:
            return true;
    }
    // TODO assert(false && "switch statement not exhaustive");
    return false;
}

export const enum SelfClosingPolicy {
    allowed = "allowed",
    prohibited = "prohibited",
    required = "required",
};

export const enum SelfClosingMarker {
    absent = "absent",
    present = "present",
};

export function isSelfClosing(marker: SelfClosingMarker, policy: SelfClosingPolicy): boolean {
    return policy === SelfClosingPolicy.required || (policy === SelfClosingPolicy.allowed && marker === SelfClosingMarker.present);
}

export class LandmarksRange {
    readonly start: LandmarksPosition;
    readonly end: LandmarksPosition;

    constructor(start: LandmarksPosition = npos, end: LandmarksPosition = npos) {
        if ((start < 0) || (end < start)) {
            throw "Range positions must be positive integers with start <= end";
        }
        this.start = start; this.end = end;
    };

    get isComplete(): boolean {
        return this.end !== npos;
    }

    get isEmpty() : boolean {
        return (this.start === npos) || this.start === this.end;
    }

    getText(document: string) : string {
        if (this.start === npos) {
            return "";
        }
        
        return document.substring(this.start, this.end);
    }

    getDecodedText(document: string) : string {
        return decodeEntities(this.getText(document));
    }

    static invalid = new LandmarksRange(npos, npos);
};

export class LandmarksRangeCData extends LandmarksRange {
    
    getDecodedText(document: string) : string {
        let text = this.getText(document);
        return text.substring("<![CDATA[".length, text.length - "]]>".length);
    }
}

class Nameable {
    readonly name: LandmarksRange;

    constructor(name : LandmarksRange) {
        this.name = name;
    };

    get isNameComplete(): boolean {
        return this.name.isComplete;
    }

    getQualifiedName(document: string) : { prefix: string, localName: string } {
        const name = this.name.getText(document);
        const prefixEnd = name.indexOf(":");
        let prefix = "";
        let localName = name;
        if (prefixEnd >= 0) {
            prefix = name.substr(0, prefixEnd);
            localName = name.substr(prefixEnd + 1);
        }
        return { prefix, localName };
    }
}

export class LandmarksAttribute extends Nameable {
    all: LandmarksRange;
    value: LandmarksRange;

    constructor(startName: LandmarksPosition, endName: LandmarksPosition) {
        super(new LandmarksRange(startName, endName));
        this.all = this.name;
        this.value = new LandmarksRange(this.name.end, this.name.end);
    };

    get isComplete(): boolean {
        return this.value.isComplete;
    }
};

export type TagID = string;
export const UnknownTagID : TagID = "(unknown)";

export class LandmarksTagPrefix extends Nameable {
    all: LandmarksRange;
    tagID: TagID = UnknownTagID;

    constructor(start: LandmarksPosition, startName: LandmarksPosition, endName: LandmarksPosition) {
        super(new LandmarksRange(startName, endName));
        this.all = new LandmarksRange(start, endName);
    }
};

export class LandmarksStartTagPrefix extends LandmarksTagPrefix {
};

export class LandmarksStartTag extends LandmarksStartTagPrefix {
    selfClosingPolicy: SelfClosingPolicy = SelfClosingPolicy.allowed;
    selfClosingMarker: SelfClosingMarker = SelfClosingMarker.absent;

    get isSelfClosing(): boolean {
        return isSelfClosing(this.selfClosingMarker, this.selfClosingPolicy);
    }
};

export class LandmarksEndTagPrefix extends LandmarksTagPrefix {
    state: EndTagState = EndTagState.unmatched;
};

export class LandmarksEndTag extends LandmarksEndTagPrefix {
};
