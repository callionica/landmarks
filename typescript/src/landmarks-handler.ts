// ALL RIGHTS RESERVED

import { LandmarksRange, LandmarksStartTag, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTagPrefix, LandmarksEndTag, TagID } from "./landmarks-parser-types";

export interface LandmarksHandler {
    seen_text(document : string, range : LandmarksRange) : void;
    seen_comment(document : string, range : LandmarksRange) : void;
    seen_cdata(document : string, range : LandmarksRange) : void;
    seen_processing(document : string, range : LandmarksRange) : void;
    seen_declaration(document : string, range : LandmarksRange) : void;

    seen_start_tag_prefix(document : string, tag : LandmarksStartTagPrefix) : void;
    seen_start_tag_attribute(document : string, attribute : LandmarksAttribute) : void;
    seen_start_tag(document : string, tag : LandmarksStartTag) : void;

    seen_end_tag_prefix(document : string, tag : LandmarksEndTagPrefix) : void;
    seen_end_tag_attribute(document : string, attribute : LandmarksAttribute) : void;
    seen_end_tag(document : string, tag : LandmarksEndTag) : void;

    seen_eof(document : string, open_elements : TagID[]) : void;
};