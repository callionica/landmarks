// ALL RIGHTS RESERVED

import { LandmarksParserConstants } from "./landmarks-parser-constants.js";
import { LandmarksPosition, npos, LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksStartTag, LandmarksEndTagPrefix, LandmarksEndTag, TagID, EndTagState, SelfClosingPolicy, SelfClosingMarker } from "./landmarks-parser-types.js";
import { LandmarksHandler } from "./landmarks-handler.js"
import { LandmarksPolicy } from "./landmarks-policy.js"

type AttributeCallback = (attr: LandmarksAttribute) => void;

// Define some constants and functions to make it easier to convert C++ code

function find(text: string, term: string, position: LandmarksPosition = 0) {
    return text.indexOf(term, position);
}

function findFirstOf(text: string, characters: string, position: LandmarksPosition = 0) {
    var pos = position;
    while (pos < text.length) {
        var character = text[pos];
        if (characters.includes(character)) {
            return pos;
        }
        ++pos;
    }
    return npos;
}

function findFirstNotOf(text: string, characters: string, position: LandmarksPosition = 0) {
    var pos = position;
    while (pos < text.length) {
        var character = text[pos];
        if (!characters.includes(character)) {
            return pos;
        }
        ++pos;
    }
    return npos;
}

function choose(text: string, position: LandmarksPosition, choices: string[]) {
    let remaining = text.length - position;
    for (var choice of choices) {
        if (choice.length <= remaining) {
            // TODO Efficiency
            var partial = text.substring(position, position + choice.length);
            if (partial === choice) {
                return choice;
            }
        }
    }

    return null;
}

export function LandmarksParser(document: string, policy: LandmarksPolicy, handler: LandmarksHandler) {
    let constants = LandmarksParserConstants();
    let length = document.length;

    function findEnd(term: string, position: LandmarksPosition) {
        var found = find(document, term, position);
        if (found != npos) {
            found += term.length;
        }
        return found;
    }

    function skipSpaces(position: LandmarksPosition) {
        return findFirstNotOf(document, constants.spaces, position);
    }

    //////
    function seen_text(rng: LandmarksRange) {
        handler.Text(document, rng);
    }

    function seen_comment(rng: LandmarksRange) {
        handler.Comment(document, rng);
    }

    function seen_cdata(rng: LandmarksRange) {
        handler.CData(document, rng);
    }

    function seen_processing(rng: LandmarksRange) {
        handler.Processing(document, rng);
    }

    function seen_declaration(rng: LandmarksRange) {
        handler.Declaration(document, rng);
    }

    function seen_start_tag_prefix(tag: LandmarksStartTagPrefix) {
        handler.StartTagPrefix(document, tag);
    }

    function seen_start_tag_attribute(attr: LandmarksAttribute) {
        handler.StartTagAttribute(document, attr);
    }

    function seen_end_tag_attribute(attr: LandmarksAttribute) {
        handler.EndTagAttribute(document, attr);
    }

    function seen_start_tag(tag: LandmarksStartTag) {
        handler.StartTag(document, tag);
    }

    function seen_end_tag_prefix(tag: LandmarksEndTagPrefix) {
        handler.EndTagPrefix(document, tag);
    }

    function seen_end_tag(tag: LandmarksEndTag) {
        handler.EndTag(document, tag);
    }

    function seen_eof(open_elements: readonly TagID[]) {
        handler.EOF(document, open_elements);
    }

    /////

    function parseAttributes(position: LandmarksPosition, callback: AttributeCallback) {
        let attribute_spaces = constants.attribute_spaces;
        let close_choices = constants.close_choices;
        let close = constants.close;
        let attribute_name_end = constants.attribute_name_end;
        let attribute_value_end = constants.attribute_value_end;

        var search_position: LandmarksPosition = position;
        var attr: LandmarksAttribute | null = null;

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
                var choice = choose(document, search_position, close_choices);
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
            var name_start = search_position;
            search_position = findFirstOf(document, attribute_name_end, search_position + 1);

            var name_end = search_position;
            attr = new LandmarksAttribute(name_start, name_end);

            if (search_position === npos) {
                // Hit the end of the string
                break;
            }

            {
                var choice = choose(document, search_position, close_choices);
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

            var found_end_tag = false;
            var value_start = search_position;
            var value_end = value_start;
            var s = document[value_start];
            if (s === '"' || s === '\'') {
                ++value_start;
                if (value_start >= length) {
                    value_start = npos;
                }
                value_end = find(document, s, value_start);
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

    function parse() {
        let open = constants.open;
        let open_choices = constants.open_choices;
        let element_name_end = constants.element_name_end;
        let open_end_tag = constants.open_end_tag;
        let close = constants.close;

        var start_position = 0; // The start of the current token
        var search_position = 0; // The point we'll search from

        var elements: TagID[] = []; // The stack of open elements
        var back = function () { return elements[elements.length - 1]; };

        while (search_position < length) {
            search_position = find(document, open, search_position);
            if (search_position === npos) {
                break;
            }

            if (search_position != start_position) {
                seen_text(new LandmarksRange(start_position, search_position));
            }

            start_position = search_position;

            var choice = choose(document, start_position, open_choices);

            if (choice === open) {
                // We found '<', but it's not an end tag, comment, cdata, processing, or declaration, so it's either a start tag or text
                // depending on whether it's followed by a valid element name
                var start_name_o = policy.getElementNameStart(document, start_position + open.length);
                if (start_name_o != npos) {
                    var start_name = start_name_o;
                    var end_name = findFirstOf(document, element_name_end, start_name);

                    var tag = new LandmarksStartTag();
                    tag.all = new LandmarksRange(start_position, end_name);
                    tag.name = new LandmarksRange(start_name, end_name);

                    if (end_name === npos) {
                        // We don't normalize the name when the name is incomplete

                        seen_start_tag_prefix(tag);
                        seen_start_tag(tag);

                        start_position = search_position = npos;
                        break;
                    }

                    var original_element_name = document.substr(start_name, end_name - start_name);
                    var tagID = policy.getTagID(original_element_name);

                    tag.tagID = tagID;

                    if (elements.length > 0) {
                        var index = elements.length;
                        for (; index > 0; --index) {
                            var open_element = elements[index - 1];
                            // If there is an open element that the current start tag can autoclose,
                            // we close all elements in the stack until we get to the autoclosing sibling
                            if (policy.isAutoclosingSibling(open_element, tagID)) {
                                var count = elements.length - (index - 1);
                                while (count--) {
                                    var t = back();
                                    var endTag = new LandmarksEndTag();
                                    endTag.all = new LandmarksRange(start_position, start_position);
                                    endTag.name = endTag.all;
                                    endTag.tagID = back();
                                    endTag.state = EndTagState.autoclosedBySibling;
                                    seen_end_tag_prefix(endTag);
                                    seen_end_tag(endTag);
                                    elements.pop();
                                }
                                break;
                            }
                        }
                    }

                    seen_start_tag_prefix(tag);

                    search_position = parseAttributes(end_name, seen_start_tag_attribute);

                    if (policy.isVoidElement(tagID)) {
                        tag.self_closing_policy = SelfClosingPolicy.required;
                    } else if (policy.isContentElement(tagID)) {
                        tag.self_closing_policy = SelfClosingPolicy.prohibited;
                    }

                    if (search_position < length - 1) {
                        tag.self_closing_marker = (document[search_position] == '/') ? SelfClosingMarker.present : SelfClosingMarker.absent;
                    }

                    var end = findEnd(close, search_position);
                    tag.all = new LandmarksRange(start_position, end);
                    seen_start_tag(tag);
                    start_position = search_position = end;

                    if (!tag.isSelfClosing) {
                        elements.push(tagID);

                        if (policy.isOpaqueElement(tagID)) {
                            // Find end tag without other parsing
                            while (search_position !== npos) {
                                // Search for the end tag
                                search_position = findEnd(open_end_tag, search_position);
                                if (search_position < length) {
                                    var start_name_o = policy.getElementNameStart(document, search_position);
                                    var start_name = (start_name_o != npos) ? start_name_o : search_position;
                                    var end_name = findFirstOf(document, element_name_end, start_name);
                                    var pos = (start_name > length) ? length : start_name;
                                    var currentID = policy.getTagID(document.substr(pos, end_name - pos));

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
                var start_name_o = policy.getElementNameStart(document, start_position + open_end_tag.length);
                // REVIEW: Unlike how we treat start tag markup, we don't allow an end tag to ever be interpreted as text
                var start_name = (start_name_o != npos) ? start_name_o : start_position + open_end_tag.length;
                if (start_name >= length) {
                    start_name = npos;
                }
                var end_name = findFirstOf(document, element_name_end, start_name);
                var pos = (start_name > length) ? length : start_name;
                var el_name = document.substr(pos, end_name - pos);
                var tagID = policy.getTagID(el_name);

                var end_state = EndTagState.floating;

                if (elements.length > 0) {
                    // If the end tag is a wildcard, it takes on the tag ID of the last open element
                    if (policy.isWildcardEndTag(tagID)) {
                        tagID = back();
                    }

                    if (policy.isSameElement(tagID, back())) {
                        // We've found a matching end tag with no children
                        end_state = EndTagState.matching;
                        elements.pop();
                    } else {
                        // Now we need to look thru the open elements
                        // If the close tag is for a landmark and there's a matching open tag on the stack
                        // Or if the stack contains autoclose_by_parent items
                        // Then we need to close them
                        var landmark = policy.isAutoclosingEndTag(tagID);

                        var state = landmark ? EndTagState.autoclosedByAncestor : EndTagState.autoclosedByParent;
                        var index = elements.length;
                        for (; index > 0; --index) {
                            var e = elements[index - 1];
                            var autoclose = policy.isAutocloseByParent(e);

                            if (policy.isSameElement(e, tagID)) {
                                // If we get here, the current end tag is for an open element
                                // and either all children autoclose when the parent closes
                                // or the current end tag is a landmark
                                while (!policy.isSameElement(back(), tagID)) {
                                    // Close all the autoclosing elements
                                    var endTag = new LandmarksEndTag();
                                    endTag.all = new LandmarksRange(start_position, start_position);
                                    endTag.name = endTag.all;
                                    endTag.tagID = back();
                                    endTag.state = state;
                                    seen_end_tag_prefix(endTag);
                                    seen_end_tag(endTag);
                                    elements.pop();
                                }
                                // Pop the current element
                                end_state = EndTagState.matching;
                                elements.pop();
                            } else if (landmark || autoclose) {
                                continue;
                            }

                            break;
                        }
                    }
                }

                var endTag = new LandmarksEndTag();
                endTag.all = new LandmarksRange(start_position, end_name);
                endTag.name = new LandmarksRange(start_name, end_name);
                endTag.tagID = tagID;
                endTag.state = end_state;

                seen_end_tag_prefix(endTag);

                search_position = parseAttributes(end_name, seen_end_tag_attribute);

                var end = findEnd(close, search_position);

                endTag.all = new LandmarksRange(start_position, end);

                seen_end_tag(endTag);

                start_position = search_position = end;
            } else if (choice === constants.open_comment) {
                // Note that we search from the start of the token so that start and end tokens can overlap
                // Example: <!--> is a complete comment
                var end = findEnd(constants.close_comment, search_position);
                seen_comment(new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else if (choice === constants.open_cdata) {
                var end = findEnd(constants.close_cdata, search_position);
                seen_cdata(new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else if (choice === constants.open_processing) {
                var end = findEnd(constants.close_processing, search_position);
                seen_processing(new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else if (choice === constants.open_declaration) {
                var end = findEnd(constants.close_declaration, search_position);
                seen_declaration(new LandmarksRange(start_position, end));
                start_position = search_position = end;
            } else {
                // TODO assert(false);
            }

        } // while

        if (search_position != start_position) {
            seen_text(new LandmarksRange(start_position, search_position));
        }

        // Close the inner contiguous set of elements that are autoclosed by parent
        while ((elements.length > 0) && policy.isAutocloseByParent(back())) {
            // Close all the autoclosing elements
            var endTag = new LandmarksEndTag();
            endTag.all = new LandmarksRange(search_position, search_position);
            endTag.name = endTag.all;
            endTag.tagID = back();
            endTag.state = EndTagState.autoclosedByParent;
            seen_end_tag_prefix(endTag);
            seen_end_tag(endTag);
            elements.pop();
        }

        // The parse is "clean" if there are no open elements
        seen_eof(elements);
    }

    return {
        document,
        parse,
    };
}