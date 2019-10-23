// ALL RIGHTS RESERVED

import { TagID, LandmarksPosition } from "./landmarks-parser-types";

// An interface that allows you to get help from the compiler when implementing a Policy used by the Parser
// A Policy controls various aspects of the Parser's behavior for example:
// Which characters can be ignored between < and the start of an element name
// Which characters are valid at the start of an element name
// Which element names are considered the same (case-sensitivity)
// Which elements are allowed or prevented from being self-closing (<element/>)
// Which elements have content that is not parsed as markup
// Which elements can be autoclosed or autoclose other elements
export interface LandmarksPolicy {
    // pos is the position after markup < or </
    // If the text following that markup represents a valid element name, return the position of the first character
    // of the name, otherwise return npos.
    // This function allows you to control which characters are considered valid for starting element names
    // (including allowing whitespace to appear after tag markup but before the name if you like).
    // As a result this function gives you control over whether < is actually treated as the start of a tag or as text.
    // The standard policy just checks the character at pos against A-z 0-9 and returns pos for a match
    // (The policy does not get to decide where the element name ends - that's handled by the parser)
    get_element_name_start(text : string, pos : LandmarksPosition) : LandmarksPosition;
    
    // The policy converts an element's name into a TagID
    // This can be used for normalizing element names to increase the efficiency of the parser
    // For example, you can put case-folding here
    // Constraining the length of TagIDs can be an important protection against malicious input
    // and for controlling memory use since there can be dynamic allocation here.
    get_TagID(name : string) : TagID;

    // Do these two TagIDs represent the same element?
    // If you don't do case-folding in get_TagID, you can put case-sensitivity logic here
    is_same_element(lhs : TagID, rhs : TagID) : boolean;
    
    // A "void element" is one where the start tag is always self-closing whether marked or not
    // so <void> and <void/> are both self-closing
    is_void_element(tagID : TagID) : boolean;
    
    // A "content element" is one where the start tag is never self-closing whether marked or not
    // so <content> and <content/> are both non-self closing start tags
    is_content_element(tagID : TagID) : boolean;
    
    // An "opaque element" is one where the content of the element is opaque text that is not parsed
    // The parser just looks for the end tag
    // so <opaque><something></something></opaque> will treat "<something></something>" as text
    is_opaque_element(tagID : TagID) : boolean;
    
    // Return true if when we see a start tag with siblingID and there is an open element with tagID, we should close the element with tagID
    // <tagID><siblingID> --> <tagID></tagID><siblingID>
    is_autoclosing_sibling(tagID : TagID, siblingID : TagID) : boolean;
    
    // Return true if this element should be closed when its parent is closed even if we haven't seen its end tag
    // These elements are also closed by EOF as long as all children are also closed
    // <parent><tagID></parent> --> <parent><tagID></tagID></parent>
    is_autoclose_by_parent(tagID : TagID) : boolean;

    // If the end tag is a wildcard, it takes on the tag ID of the last open element
    // For example, you could allow </> to be the end tag for any open tag by returning true for any empty name
    // or you could completely ignore the names of end tags by returning true without even looking at the name
    // HTML and XML don't have wildcard end tags
    is_wildcard_end_tag(tagID : TagID) : boolean;
    
    // Return true if seeing the end tag for this element will close all open elements contained within
    // Note that this only closes elements when we see both the start tag and the end tag; a floating or autocreated end tag does not close open elements
    // <tagID><child><grandchild></tagID> --> <tagID><child><grandchild></grandchild></child></tagID>
    is_autoclosing_end_tag(tagID : TagID) : boolean;
};