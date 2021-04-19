// ALL RIGHTS RESERVED

import { LandmarksAttribute, LandmarksEndTag, LandmarksEndTagPrefix, LandmarksRange, LandmarksStartTag, LandmarksStartTagPrefix, TagID } from "./landmarks-parser-types.ts";

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

    EndOfInput(document: string, open_elements: readonly TagID[]): void;
};

export class BaseHandler implements LandmarksHandler {
    Text(document: string, range: LandmarksRange): void { }
    Comment(document: string, range: LandmarksRange): void { }
    CData(document: string, range: LandmarksRange): void { }
    Processing(document: string, range: LandmarksRange): void { }
    Declaration(document: string, range: LandmarksRange): void { }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix): void { }
    StartTagAttribute(document: string, attribute: LandmarksAttribute): void { }
    StartTag(document: string, tag: LandmarksStartTag): void { }

    EndTagPrefix(document: string, tag: LandmarksEndTagPrefix): void { }
    EndTagAttribute(document: string, attribute: LandmarksAttribute): void { }
    EndTag(document: string, tag: LandmarksEndTag): void { }

    EndOfInput(document: string, open_elements: readonly TagID[]): void { }
}

export class LogHandler implements LandmarksHandler {
    Text(document: string, range: LandmarksRange): void { console.log(range); }
    Comment(document: string, range: LandmarksRange): void { console.log(range); }
    CData(document: string, range: LandmarksRange): void { console.log(range); }
    Processing(document: string, range: LandmarksRange): void { console.log(range); }
    Declaration(document: string, range: LandmarksRange): void { console.log(range); }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix): void { console.log(tag); }
    StartTagAttribute(document: string, attribute: LandmarksAttribute): void { console.log(attribute); }
    StartTag(document: string, tag: LandmarksStartTag): void { console.log(tag); console.log(tag.getQualifiedName(document)); }

    EndTagPrefix(document: string, tag: LandmarksEndTagPrefix): void { console.log(tag); }
    EndTagAttribute(document: string, attribute: LandmarksAttribute): void { console.log(attribute); }
    EndTag(document: string, tag: LandmarksEndTag): void { console.log(tag); }

    EndOfInput(document: string, open_elements: readonly TagID[]): void { console.log(open_elements); }
}