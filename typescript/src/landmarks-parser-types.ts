// ALL RIGHTS RESERVED

export type LandmarksPosition = number;
export const npos : LandmarksPosition = -1;

export enum EndTagState {
    floating               = 0, // No matching start tag
    matching               = 1, // Matching start tag
    autoclosed_by_parent   = 2, // Closed when parent closed (or EOF)
    autoclosed_by_sibling  = 3, // Closed when specific sibling opened
    autoclosed_by_ancestor = 4, // Closed when specific ancestor closed
};

export function isAutoclosed(state : EndTagState) : boolean  {
    switch (state) {
        case EndTagState.floating: // fallthrough
        case EndTagState.matching:
            return false;
        case EndTagState.autoclosed_by_parent  : // fallthrough
        case EndTagState.autoclosed_by_sibling : // fallthrough
        case EndTagState.autoclosed_by_ancestor:
            return true;
    }
    // TODO assert(false && "switch statement not exhaustive");
    return false;
}

export enum SelfClosingPolicy {
    allowed    = 0,
    prohibited = 1,
    required   = 2,
};

export enum SelfClosingMarker {
    absent  = 0,
    present = 1,
};

export function isSelfClosing(marker : SelfClosingMarker, policy : SelfClosingPolicy) : boolean {
    return policy === SelfClosingPolicy.required || (policy === SelfClosingPolicy.allowed && marker === SelfClosingMarker.present);
}

export class LandmarksRange {
    readonly start: LandmarksPosition;
    readonly end: LandmarksPosition;

    constructor(start: LandmarksPosition = npos, end: LandmarksPosition = npos) {
        this.start = start; this.end = end;
    };

    get isComplete() : boolean {        
        return this.end !== npos;
    }
};

export class LandmarksAttribute {
    name: LandmarksRange;
    value: LandmarksRange;
    all: LandmarksRange;

    constructor(start: LandmarksPosition, end: LandmarksPosition) {
        this.name = new LandmarksRange(start, end);
        this.value = new LandmarksRange(start, end);
        this.all = new LandmarksRange(end, end);
    };

    get isComplete() : boolean {
        return this.value.isComplete;
    }

    get isNameComplete() : boolean {
        return this.name.isComplete;
    }
};

export type TagID = string;

export class LandmarksTagPrefix {
    tagID: TagID = "";
    name: LandmarksRange = new LandmarksRange();
    all: LandmarksRange = new LandmarksRange();;
};

export class LandmarksStartTagPrefix extends LandmarksTagPrefix {
};

export class LandmarksStartTag extends LandmarksStartTagPrefix {
    self_closing_policy : SelfClosingPolicy = SelfClosingPolicy.allowed;
    self_closing_marker : SelfClosingMarker = SelfClosingMarker.absent;

    get isSelfClosing() : boolean {
        return isSelfClosing(this.self_closing_marker, this.self_closing_policy);
    }
};

export class LandmarksEndTagPrefix extends LandmarksTagPrefix {
    state : EndTagState = EndTagState.floating;
};

export class LandmarksEndTag extends LandmarksEndTagPrefix {
};
