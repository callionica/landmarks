// ALL RIGHTS RESERVED

import { TagID, LandmarksPosition, npos } from "./landmarks-parser-types.js";

// An interface that allows you to get help from the compiler when implementing a Policy used by the Parser
// A Policy controls various aspects of the Parser's behavior for example:
// Which characters can be ignored between < and the start of an element name
// Which characters are valid at the start of an element name
// Which element names are considered the same (case-sensitivity)
// Which elements are allowed or prevented from being self-closing (<element/>)
// Which elements have content that is not parsed as markup
// Which elements can be autoclosed or autoclose other elements
export interface LandmarksPolicy {
    readonly spaces : string;

    // pos is the position after markup < or </
    // If the text following that markup represents a valid element name, return the position of the first character
    // of the name, otherwise return npos.
    // This function allows you to control which characters are considered valid for starting element names
    // (including allowing whitespace to appear after tag markup but before the name if you like).
    // As a result this function gives you control over whether < is actually treated as the start of a tag or as text.
    // The standard policy just checks the character at pos against A-z 0-9 and returns pos for a match
    // (The policy does not get to decide where the element name ends - that's handled by the parser)
    getElementNameStart(text: string, pos: LandmarksPosition): LandmarksPosition;

    // The policy converts an element's name into a TagID
    // This can be used for normalizing element names to increase the efficiency of the parser
    // For example, you can put case-folding here
    // Constraining the length of TagIDs can be an important protection against malicious input
    // and for controlling memory use since there can be dynamic allocation here.
    getTagID(name: string): TagID;

    // Do these two TagIDs represent the same element?
    // If you don't do case-folding in get_TagID, you can put case-sensitivity logic here
    isSameElement(lhs: TagID, rhs: TagID): boolean;

    // A "void element" is one where the start tag is always self-closing whether marked or not
    // so <void> and <void/> are both self-closing
    isVoidElement(tagID: TagID): boolean;

    // A "content element" is one where the start tag is never self-closing whether marked or not
    // so <content> and <content/> are both non-self closing start tags
    isContentElement(tagID: TagID): boolean;

    // An "opaque element" is one where the content of the element is opaque text that is not parsed
    // The parser just looks for the end tag
    // so <opaque><something></something></opaque> will treat "<something></something>" as text
    isOpaqueElement(tagID: TagID): boolean;

    // Return true if when we see a start tag with siblingID and there is an open element with tagID, we should close the element with tagID
    // <tagID><siblingID> --> <tagID></tagID><siblingID>
    isAutoclosingSibling(tagID: TagID, siblingID: TagID): boolean;

    // Return true if this element should be closed when its parent is closed even if we haven't seen its end tag
    // These elements are also closed by EOF as long as all children are also closed
    // <parent><tagID></parent> --> <parent><tagID></tagID></parent>
    isAutocloseByParent(tagID: TagID): boolean;

    // If the end tag is a wildcard, it takes on the tag ID of the last open element
    // For example, you could allow </> to be the end tag for any open tag by returning true for any empty name
    // or you could completely ignore the names of end tags by returning true without even looking at the name
    // HTML and XML don't have wildcard end tags
    isWildcardEndTag(tagID: TagID): boolean;

    // Return true if seeing the end tag for this element will close all open elements contained within
    // Note that this only closes elements when we see both the start tag and the end tag; a floating or autocreated end tag does not close open elements
    // <tagID><child><grandchild></tagID> --> <tagID><child><grandchild></grandchild></child></tagID>
    isAutoclosingEndTag(tagID: TagID): boolean;
};

type TagAndSiblings = [string, string[]];

export interface LandmarksPolicyData {
    Spaces: string;
    VoidElements: readonly string[];
    ContentElements: readonly string[];
    OpaqueElements: readonly string[];
    AutoclosingEndTags: readonly string[];
    AutocloseByParent: readonly string[];
    AutocloseBySibling: readonly TagAndSiblings[];
    WildcardEndTags: readonly string[];
}

const charCode = {
    "0": "0".charCodeAt(0),
    "9": "9".charCodeAt(0),
    "A": "A".charCodeAt(0),
    "z": "z".charCodeAt(0),
};

export class Policy implements LandmarksPolicy {

    private readonly data: LandmarksPolicyData;

    constructor(data: LandmarksPolicyData) {
        this.data = data;
    }

    get spaces() : string {
        return this.data.Spaces;
    }

    getElementNameStart(text: string, pos: number): number {
        if (pos < text.length) {
            var name_start = text.charCodeAt(pos);
            if ((charCode['0'] <= name_start && name_start <= charCode['9']) || (charCode['A'] <= name_start && name_start <= charCode['z'])) {
                return pos;
            }
        }
        return npos;
    }

    getTagID(name: string): string {
        return name.toLowerCase();
    }

    isSameElement(lhs: TagID, rhs: TagID): boolean {
        return lhs === rhs;
    }

    isVoidElement(tagID: TagID): boolean {
        return this.data.VoidElements.includes(tagID);
    }

    isContentElement(tagID: TagID): boolean {
        return this.data.ContentElements.includes(tagID);
    }

    isOpaqueElement(tagID: TagID): boolean {
        return this.data.OpaqueElements.includes(tagID);
    }

    isAutoclosingSibling(tagID: TagID, siblingID: TagID): boolean {
        var entry = this.data.AutocloseBySibling.find((e: TagAndSiblings) => {
            return e[0] === tagID;
        });
        if (entry) {
            return entry[1].includes(siblingID);
        }
        return false;
    }

    isAutocloseByParent(tagID: TagID): boolean {
        return this.data.AutocloseByParent.includes(tagID);
    }

    isWildcardEndTag(tagID: TagID): boolean {
        return this.data.WildcardEndTags.includes(tagID);
    }

    isAutoclosingEndTag(tagID: TagID): boolean {
        return this.data.AutoclosingEndTags.includes(tagID);
    }
}