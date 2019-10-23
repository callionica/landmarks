export type LandmarksPosition = number;
export const npos : LandmarksPosition = -1;

export enum EndTagState {
    floating               = 0, // No matching start tag
    matching               = 1, // Matching start tag
    autoclosed_by_parent   = 2, // Closed when parent closed (or EOF)
    autoclosed_by_sibling  = 3, // Closed when specific sibling opened
    autoclosed_by_ancestor = 4, // Closed when specific ancestor closed
};

export function is_autoclosed(state : EndTagState) : boolean  {
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

export function is_self_closing(marker : SelfClosingMarker, policy : SelfClosingPolicy) : boolean {
    return policy === SelfClosingPolicy.required || (policy === SelfClosingPolicy.allowed && marker === SelfClosingMarker.present);
}

export class LandmarksRange {
    start: LandmarksPosition;
    end: LandmarksPosition;

    constructor(start: LandmarksPosition = npos, end: LandmarksPosition = npos) {
        this.start = start; this.end = end;
    };

    is_complete() : boolean {        
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

    is_complete() : boolean {        
        return this.value.is_complete();
    }

    is_name_complete() : boolean {
        return this.name.is_complete();
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

    is_self_closing() : boolean {
        return is_self_closing(this.self_closing_marker, this.self_closing_policy);
    }
};

export class LandmarksEndTagPrefix extends LandmarksTagPrefix {
    state : EndTagState = EndTagState.floating;
};

export class LandmarksEndTag extends LandmarksEndTagPrefix {
};
