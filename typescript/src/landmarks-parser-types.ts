// ALL RIGHTS RESERVED

export type LandmarksPosition = number;
export const npos: LandmarksPosition = -1;

export enum EndTagState {
    floating = "floating", // No matching start tag
    matching = "matching", // Matching start tag
    autoclosedByParent = "autoclosedByParent", // Closed when parent closed (or EOF)
    autoclosedBySibling = "autoclosedBySibling", // Closed when specific sibling opened
    autoclosedByAncestor = "autoclosedByAncestor", // Closed when specific ancestor closed
};

export function isAutoclosed(state: EndTagState): boolean {
    switch (state) {
        case EndTagState.floating: // fallthrough
        case EndTagState.matching:
            return false;
        case EndTagState.autoclosedByParent: // fallthrough
        case EndTagState.autoclosedBySibling: // fallthrough
        case EndTagState.autoclosedByAncestor:
            return true;
    }
    // TODO assert(false && "switch statement not exhaustive");
    return false;
}

export enum SelfClosingPolicy {
    allowed = "allowed",
    prohibited = "prohibited",
    required = "required",
};

export enum SelfClosingMarker {
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
        this.start = start; this.end = end;
    };

    get isComplete(): boolean {
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

    get isComplete(): boolean {
        return this.value.isComplete;
    }

    get isNameComplete(): boolean {
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
    selfClosingPolicy: SelfClosingPolicy = SelfClosingPolicy.allowed;
    selfClosingMarker: SelfClosingMarker = SelfClosingMarker.absent;

    get isSelfClosing(): boolean {
        return isSelfClosing(this.selfClosingMarker, this.selfClosingPolicy);
    }
};

export class LandmarksEndTagPrefix extends LandmarksTagPrefix {
    state: EndTagState = EndTagState.floating;
};

export class LandmarksEndTag extends LandmarksEndTagPrefix {
};
