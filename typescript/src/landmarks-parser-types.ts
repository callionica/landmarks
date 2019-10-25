// ALL RIGHTS RESERVED

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

    getText(document: string) : string {
        if (this.start === npos) {
            return "";
        }
        
        return document.substring(this.start, this.end);
    }
};

class Nameable {
    name: LandmarksRange;
    all: LandmarksRange;

    constructor(start: LandmarksPosition, end: LandmarksPosition) {
        this.name = new LandmarksRange(start, end);
        this.all = new LandmarksRange(end, end);
    };

    get isNameComplete(): boolean {
        return this.name.isComplete;
    }

    getQualifiedName(document: string) {
        const name = this.name.getText(document);
        const prefixEnd = name.indexOf(":");
        let prefix = "";
        let localName = name;
        if (prefixEnd >= 0) {
            prefix = name.substr(0, prefixEnd);
            localName = name.substr(prefixEnd + 1);
        }
        return [prefix, localName];
    }
}

export class LandmarksAttribute extends Nameable {
    value: LandmarksRange;
    
    constructor(start: LandmarksPosition, end: LandmarksPosition) {
        super(start, end);
        this.value = new LandmarksRange(start, end);
    };

    get isComplete(): boolean {
        return this.value.isComplete;
    }
};

export type TagID = string;
export const UnknownTagID : TagID = "(unknown)";

export class LandmarksTagPrefix extends Nameable {
    tagID: TagID = "";
    
    constructor() {
        super(npos, npos);
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
