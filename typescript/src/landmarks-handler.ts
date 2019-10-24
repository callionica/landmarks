// ALL RIGHTS RESERVED

import { LandmarksRange, LandmarksStartTag, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTagPrefix, LandmarksEndTag, TagID } from "./landmarks-parser-types.js";

function getText(document: string, range: LandmarksRange) : string {
    return document.substring(range.start, range.end);
}

export interface LandmarksHandler {
    Text(document: string, range: LandmarksRange): void;
    Comment(document: string, range: LandmarksRange): void;
    CData(document: string, range: LandmarksRange): void;
    Processing(document: string, range: LandmarksRange): void;
    Declaration(document: string, range: LandmarksRange): void;

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix): void;
    StartTagAttribute(document: string, attribute: LandmarksAttribute): void;
    StartTag(document: string, tag: LandmarksStartTag): void;

    EndTagPrefix(document: string, tag: LandmarksEndTagPrefix): void;
    EndTagAttribute(document: string, attribute: LandmarksAttribute): void;
    EndTag(document: string, tag: LandmarksEndTag): void;

    EOF(document: string, open_elements: readonly TagID[]): void;
};

export class Logger implements LandmarksHandler {
    Text(document: string, range: LandmarksRange): void {}
    Comment(document: string, range: LandmarksRange): void {}
    CData(document: string, range: LandmarksRange): void {}
    Processing(document: string, range: LandmarksRange): void {}
    Declaration(document: string, range: LandmarksRange): void {}

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix): void {}
    StartTagAttribute(document: string, attribute: LandmarksAttribute): void {}
    StartTag(document: string, tag: LandmarksStartTag): void { console.log(tag); console.log(getText(document, tag.name)); console.log(getText(document, tag.all)); }

    EndTagPrefix(document: string, tag: LandmarksEndTagPrefix): void {}
    EndTagAttribute(document: string, attribute: LandmarksAttribute): void {}
    EndTag(document: string, tag: LandmarksEndTag): void {}

    EOF(document: string, open_elements: readonly TagID[]): void {}
}