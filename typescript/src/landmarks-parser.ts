// ALL RIGHTS RESERVED

import { LandmarksPosition, npos, LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksStartTag, LandmarksEndTagPrefix, LandmarksEndTag, TagID, UnknownTagID, EndTagState, SelfClosingPolicy, SelfClosingMarker } from "./landmarks-parser-types.js";
import { LandmarksHandler } from "./landmarks-handler.js"
import { LandmarksPolicy } from "./landmarks-policy.js"

/*
The space characters, for the purposes of this specification, are U+0020 SPACE, "tab" (U+0009), "LF" (U+000A), "FF" (U+000C), and "CR" (U+000D).
http://www.w3.org/html/wg/drafts/html/master/single-page.html#space-character
*/
function LandmarksParserConstants(spaces: string = " \t\n\f\r") {
    /*
     As in HTML5, a '/' in the middle of an attribute name creates a new attribute name and is not part of the name
     A '/' anywhere in an unquoted attribute value is part of the value (it doesn't create a new value or name and it is never part of a self-closing tag)
    */
    const attribute_spaces = spaces + "/";
    const attribute_name_end = attribute_spaces + ">=";
    const attribute_value_end = spaces + ">";
    /*
    Can customize the delimiters (quote marks) for an attribute value here,
    but note that the parser currently requires the closing delimiter
    to be the same as the opening delimiter (following HTML) so there
    is limited value in including open/close quote pairs currently
    */
    const attribute_value_delimiters = `"'`;

    const element_name_end = attribute_spaces + ">";

    const open = "<";
    const open_end_tag = "</";
    const open_comment = "<!--";
    const open_cdata = "<![CDATA[";
    const open_declaration = "<!";
    const open_processing = "<?";

    const close = ">";
    const close_self = "/>";
    const close_comment = "-->";
    const close_cdata = "]]>";
    const close_declaration = ">";
    const close_processing = "?>";

    // Order is important
    const open_choices = [
        open_end_tag, open_comment, open_cdata, open_declaration, open_processing, open
    ];

    const close_choices = [close_self, close];

    return {
        spaces,
        attribute_spaces,
        attribute_name_end,
        attribute_value_end,
        attribute_value_delimiters,
        element_name_end,
        open,
        open_end_tag,
        open_comment,
        open_cdata,
        open_declaration,
        open_processing,
        close,
        close_self,
        close_comment,
        close_cdata,
        close_declaration,
        close_processing,
        open_choices,
        close_choices,
    };
}

type AttributeCallback = (attr: LandmarksAttribute) => void;

// Define some constants and functions to make it easier to convert C++ code

function find(text: string, term: string, position: LandmarksPosition = 0) {
    const pos = text.indexOf(term, position);
    return (pos < 0) ? npos : pos;
}

function findFirstOf(text: string, characters: string, position: LandmarksPosition = 0) {
    let pos = position;
    while (pos < text.length) {
        const character = text[pos];
        if (characters.includes(character)) {
            return pos;
        }
        ++pos;
    }
    return npos;
}

function findFirstNotOf(text: string, characters: string, position: LandmarksPosition = 0) {
    let pos = position;
    while (pos < text.length) {
        const character = text[pos];
        if (!characters.includes(character)) {
            return pos;
        }
        ++pos;
    }
    return npos;
}

function choose(text: string, position: LandmarksPosition, choices: string[]) {
    const remaining = text.length - position;
    for (var choice of choices) {
        if (choice.length <= remaining) {
            // TODO Efficiency
            const partial = text.substring(position, position + choice.length);
            if (partial === choice) {
                return choice;
            }
        }
    }

    return null;
}

export interface IParser {
    parse(document: string, handler: LandmarksHandler): void;
}

export function LandmarksParser(policy: LandmarksPolicy): IParser {
    const constants = LandmarksParserConstants(policy.spaces);

    function parse(document: string, handler: LandmarksHandler) {
        const length = document.length;

        function findEnd(term: string, position: LandmarksPosition) {
            let found = find(document, term, position);
            if (found !== npos) {
                found += term.length;
            }
            return found;
        }

        function skipSpaces(position: LandmarksPosition) {
            return findFirstNotOf(document, constants.spaces, position);
        }

        function parseAttributes(position: LandmarksPosition, callback: AttributeCallback) {
            const attribute_spaces = constants.attribute_spaces;
            const close_choices = constants.close_choices;
            const close = constants.close;
            const attribute_name_end = constants.attribute_name_end;
            const attribute_value_end = constants.attribute_value_end;
            const attribute_value_delimiters = constants.attribute_value_delimiters;

            let search_position: LandmarksPosition = position;
            let attr: LandmarksAttribute | null = null;

            while (search_position < length) {

                if (attr) {
                    callback(attr);
                    attr = null;
                }

                search_position = findFirstNotOf(document, attribute_spaces, search_position);
                if (search_position === npos) {
                    // Hit the end of the string
                    break;
                }

                {
                    const choice = choose(document, search_position, close_choices);
                    if (choice === close) {
                        // We skipped spaces and slashes and we've seen >
                        // If previous character is slash, we back up since that slash is part of the self-closing token
                        if (document[search_position - 1] === '/') {
                            --search_position;
                        }
                    }

                    if (choice !== null) {
                        // Hit the end of the tag
                        break;
                    }
                }

                // Looking at attribute name
                const name_start = search_position;
                search_position = findFirstOf(document, attribute_name_end, search_position + 1);

                const name_end = search_position;
                attr = new LandmarksAttribute(name_start, name_end);

                if (search_position === npos) {
                    // Hit the end of the string
                    break;
                }

                {
                    const choice = choose(document, search_position, close_choices);
                    if (choice !== null) {
                        // Hit the end of the tag
                        break;
                    }
                }

                search_position = skipSpaces(search_position);
                if (search_position === npos) {
                    // Hit the end of the string
                    break;
                }

                if (document[search_position] !== '=') {
                    continue;
                }

                // Looking at attribute value

                search_position = skipSpaces(search_position + 1);
                if (search_position === npos) {
                    // Hit the end of the string
                    break;
                }

                let found_end_tag = false;
                let value_start = search_position;
                let value_end = value_start;
                const s = document[value_start];
                if (attribute_value_delimiters.includes(s)) {
                    ++value_start;
                    if (value_start >= length) {
                        value_start = npos;
                    }
                    value_end = find(document, s, value_start); // Currently require end quote to be same as start quote as in HTML
                    if (value_end !== npos) {
                        search_position = value_end + 1;
                    } else {
                        search_position = value_end;
                    }
                } else {
                    search_position = findFirstOf(document, attribute_value_end, search_position);
                    value_end = search_position;
                    if (value_end !== npos) {
                        var e = document[value_end];
                        found_end_tag = (e === '>');
                    }
                }

                attr.value = new LandmarksRange(value_start, value_end);
                attr.all = new LandmarksRange(name_start, search_position);

                if (found_end_tag) {
                    break;
                }
            }

            if (attr) {
                callback(attr);
                attr = null;
            }

            return search_position;
        }
        const open = constants.open;
        const open_choices = constants.open_choices;
        const element_name_end = constants.element_name_end;
        const open_end_tag = constants.open_end_tag;
        const close = constants.close;

        let start_position = 0; // The start of the current token
        let search_position = 0; // The point we'll search from

        const elements: TagID[] = []; // The stack of open elements
        const back = function () { return elements[elements.length - 1]; };

        while (search_position < length) {
            search_position = find(document, open, search_position);
            if (search_position === npos) {
                break;
            }

            if (search_position != start_position) {
                handler.Text(document, new LandmarksRange(start_position, search_position));
            }

            start_position = search_position;

            const choice = choose(document, start_position, open_choices);

            if (choice === open) {
                // We found '<', but it's not an end tag, comment, cdata, processing, or declaration, so it's either a start tag or text
                // depending on whether it's followed by a valid element name
                const start_name_o = policy.getElementNameStart(document, start_position + open.length);
                if (start_name_o != npos) {
                    const start_name = start_name_o;
                    const end_name = findFirstOf(document, element_name_end, start_name);

                    const tag = new LandmarksStartTag(start_position, start_name, end_name);
                    if (end_name === npos) {
                        // We don't normalize the name when the name is incomplete

                        handler.StartTagPrefix(document, tag);
                        handler.StartTag(document, tag);

                        start_position = search_position = npos;
                        break;
                    }

                    const original_element_name = document.substr(start_name, end_name - start_name);
                    const tagID = policy.getTagID(original_element_name);

                    tag.tagID = tagID;

                    if (elements.length > 0) {
                        let index = elements.length;
                        for (; index > 0; --index) {
                            const open_element = elements[index - 1];
                            // If there is an open element that the current start tag can autoclose,
                            // we close all elements in the stack until we get to the autoclosing sibling
                            if (policy.isAutoclosingSibling(open_element, tagID)) {
                                let count = elements.length - (index - 1);
                                while (count--) {
                                    const t = back();
                                    const endTag = new LandmarksEndTag(start_position, start_position, start_position);
                                    endTag.tagID = back();
                                    endTag.state = EndTagState.autoclosedBySibling;
                                    handler.EndTagPrefix(document, endTag);
                                    handler.EndTag(document, endTag);
                                    elements.pop();
                                }
                                break;
                            }
                        }
                    }

                    handler.StartTagPrefix(document, tag);

                    search_position = parseAttributes(end_name, (attr) => handler.StartTagAttribute(document, attr));

                    if (policy.isVoidElement(tagID)) {
                        tag.selfClosingPolicy = SelfClosingPolicy.required;
                    } else if (policy.isContentElement(tagID)) {
                        tag.selfClosingPolicy = SelfClosingPolicy.prohibited;
                    }

                    if (search_position < length - 1) {
                        tag.selfClosingMarker = (document[search_position] == '/') ? SelfClosingMarker.present : SelfClosingMarker.absent;
                    }

                    const end = findEnd(close, search_position);
                    tag.all = new LandmarksRange(start_position, end);
                    handler.StartTag(document, tag);
                    start_position = search_position = end;

                    if (!tag.isSelfClosing) {
                        elements.push(tagID);

                        if (policy.isOpaqueElement(tagID)) {
                            // Find end tag without other parsing
                            while (search_position !== npos) {
                                // Search for the end tag
                                search_position = findEnd(open_end_tag, search_position);
                                if (search_position < length) {
                                    const start_name_o = policy.getElementNameStart(document, search_position);
                                    const start_name = (start_name_o != npos) ? start_name_o : search_position;
                                    const end_name = findFirstOf(document, element_name_end, start_name);
                                    const pos = (start_name > length) ? length : start_name;
                                    const currentID = policy.getTagID(document.substr(pos, end_name - pos));

                                    if (policy.isSameElement(tagID, currentID)) {
                                        /*
                                         We're positioned at the end of the end tag
                                         Back up to the start
                                         Next time through the main loop, we'll see the end tag
                                         produce the text token prior to it, then parse the end tag
                                         in the normal way.
                                         */
                                        search_position -= open_end_tag.length;
                                        break;
                                    }

                                    // If we didn't find the end tag, keep looking
                                }
                            }
                        }
                    }

                } else {
                    // Advance the search position without changing the anchor
                    // We'll treat this as a text token
                    ++search_position;
                }
            } else if (choice === open_end_tag) {
                const start_name_o = policy.getElementNameStart(document, start_position + open_end_tag.length);
                // REVIEW: Unlike how we treat start tag markup, we don't allow an end tag to ever be interpreted as text
                let start_name = (start_name_o != npos) ? start_name_o : start_position + open_end_tag.length;
                if (start_name >= length) {
                    start_name = npos;
                }
                const end_name = findFirstOf(document, element_name_end, start_name);
                const pos = (start_name > length) ? length : start_name;
                const el_name = document.substr(pos, end_name - pos);
                let tagID = (end_name === npos) ? UnknownTagID : policy.getTagID(el_name);

                let end_state = EndTagState.unmatched;

                if (elements.length > 0) {
                    // If the end tag is a wildcard, it takes on the tag ID of the last open element
                    if (policy.isWildcardEndTag(tagID)) {
                        tagID = back();
                    }

                    if (policy.isSameElement(tagID, back())) {
                        // We've found a matching end tag with no children
                        end_state = EndTagState.matched;
                        elements.pop();
                    } else {
                        // Now we need to look thru the open elements
                        // If the close tag is for a landmark and there's a matching open tag on the stack
                        // Or if the stack contains autoclose_by_parent items
                        // Then we need to close them
                        const landmark = policy.isAutoclosingEndTag(tagID);

                        const state = landmark ? EndTagState.autoclosedByAncestor : EndTagState.autoclosedByParent;
                        let index = elements.length;
                        for (; index > 0; --index) {
                            const e = elements[index - 1];
                            const autoclose = policy.isAutocloseByParent(e);

                            if (policy.isSameElement(e, tagID)) {
                                // If we get here, the current end tag is for an open element
                                // and either all children autoclose when the parent closes
                                // or the current end tag is a landmark
                                while (!policy.isSameElement(back(), tagID)) {
                                    // Close all the autoclosing elements
                                    const endTag = new LandmarksEndTag(start_position, start_position, start_position);
                                    endTag.tagID = back();
                                    endTag.state = state;
                                    handler.EndTagPrefix(document, endTag);
                                    handler.EndTag(document, endTag);
                                    elements.pop();
                                }
                                // Pop the current element
                                end_state = EndTagState.matched;
                                elements.pop();
                            } else if (landmark || autoclose) {
                                continue;
                            }

                            break;
                        }
                    }
                }

                const endTag = new LandmarksEndTag(start_position, start_name, end_name);
                endTag.tagID = tagID;
                endTag.state = end_state;

                handler.EndTagPrefix(document, endTag);

                search_position = parseAttributes(end_name, (attr) => handler.EndTagAttribute(document, attr));

                const end = findEnd(close, search_position);

                endTag.all = new LandmarksRange(start_position, end);

                handler.EndTag(document, endTag);

                start_position = search_position = end;
            } else if (choice === constants.open_comment) {
                // Note that we search from the start of the token so that start and end tokens can overlap
                // Example: <!--> is a complete comment
                const end = findEnd(constants.close_comment, search_position);
                handler.Comment(document, new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else if (choice === constants.open_cdata) {
                const end = findEnd(constants.close_cdata, search_position);
                handler.CData(document, new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else if (choice === constants.open_processing) {
                const end = findEnd(constants.close_processing, search_position);
                handler.Processing(document, new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else if (choice === constants.open_declaration) {
                const end = findEnd(constants.close_declaration, search_position);
                handler.Declaration(document, new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else {
                // TODO assert(false);
            }

        } // while

        if (search_position != start_position) {
            handler.Text(document, new LandmarksRange(start_position, search_position));
        }

        // Close the inner contiguous set of elements that are autoclosed by parent
        while ((elements.length > 0) && policy.isAutocloseByParent(back())) {
            // Close all the autoclosing elements
            const endTag = new LandmarksEndTag(search_position, search_position, search_position);
            endTag.tagID = back();
            endTag.state = EndTagState.autoclosedByParent;
            handler.EndTagPrefix(document, endTag);
            handler.EndTag(document, endTag);
            elements.pop();
        }

        // The parse is "clean" if there are no open elements
        handler.EOF(document, elements);
    }

    return {
        parse,
    };
}