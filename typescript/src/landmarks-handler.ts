// ALL RIGHTS RESERVED

import { LandmarksRange, LandmarksStartTag, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTagPrefix, LandmarksEndTag, TagID } from "./landmarks-parser-types";

export interface LandmarksHandler {
    Text(document : string, range : LandmarksRange) : void;
    Comment(document : string, range : LandmarksRange) : void;
    CData(document : string, range : LandmarksRange) : void;
    Processing(document : string, range : LandmarksRange) : void;
    Declaration(document : string, range : LandmarksRange) : void;

    StartTagPrefix(document : string, tag : LandmarksStartTagPrefix) : void;
    StartTagAttribute(document : string, attribute : LandmarksAttribute) : void;
    StartTag(document : string, tag : LandmarksStartTag) : void;

    EndTagPrefix(document : string, tag : LandmarksEndTagPrefix) : void;
    EndTagAttribute(document : string, attribute : LandmarksAttribute) : void;
    EndTag(document : string, tag : LandmarksEndTag) : void;

    EOF(document : string, open_elements : readonly TagID[]) : void;
};