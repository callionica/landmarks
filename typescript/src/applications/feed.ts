// ALL RIGHTS RESERVED

// A simple RSS feed parser that converts RSS to JSON
//
// "feedToJSON(string) : string" converts an RSS feed string to JSON

import { LandmarksHandler, BaseHandler } from "../landmarks-handler.js"
import { LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTag, LandmarksStartTag, LandmarksEndTagPrefix, TagID, EndTagState } from "../landmarks-parser-types.js";
import { LandmarksParser } from "../landmarks-parser.js";
import { xml } from "../landmarks-policy-ml.js";
import { encodeEntities } from "../landmarks-entities.js";

function first(text: string, count: number = 1) {
    return text.substring(0, count);
}

function last(text: string, count: number = 1) {
    return text.substring(text.length - count);
}

class LandmarksString {
    // text is normalized:
    // it won't start with whitespace
    // if it contains \n, it's deliberate; \n shouldn't be merged or ignored
    // space at the end can be merged or ignored
    // &<> are encoded
    private text: string = "";
    private trailingWhitespace: string = "";

    constructor(text: string) {
        this.append(text);
    }

    // The result includes significant whitespace, but not an ignorable trailing space
    get value() {
        if (this.trailingWhitespace != " ") {
            return this.text + this.trailingWhitespace;
        }
        return this.text;
    }

    // The result does not include any trailing whitespace
    get trimmed() {
        return this.text;
    }

    append(text: string) {
        if (text.length <= 0) {
            return;
        }

        text = encodeEntities(text);

        const normalizedText = text.replace(/\s+/g, " ");

        // If new text starts with space 
        // & there's no existing trailing whitespace
        // & there's existing text
        // then we need to track the new space
        if ((normalizedText[0] === " ") && (this.trailingWhitespace.length === 0) && (this.text.length)) {
            this.trailingWhitespace = " ";
        }

        const trimmed = normalizedText.trim();
        if (trimmed.length) {
            this.text += this.trailingWhitespace + trimmed;
            this.trailingWhitespace = (last(normalizedText) === " ") ? " " : "";;
        }
    }

    appendBreak() {
        if (last(this.trailingWhitespace) === "\n") {
            this.trailingWhitespace += "\n";
        } else {
            this.trailingWhitespace = "\n";
        }
    }

    appendOpenTag(tag: string) {
        this.text += this.trailingWhitespace + "<" + tag + ">";
        this.trailingWhitespace = "";
    }

    // appendCloseTag adds the close tag before any trailing whitespace
    appendCloseTag(tag: string) {
        this.text += "</" + tag + ">";
        // If there was trailingWhitespace it's now after the tag
    }
}

type E = { localName: string, };
type A = { };
type Element = E & A;


class Feed extends BaseHandler {
    json: any = {};

    private elements: Element[] = [];

    get path() : string {
        const separator = " > ";
        return separator + this.elements.map(e => e.localName).join(separator);
    }

    current(localName: string | undefined = undefined): Element | undefined {
        if (!localName) {
            return this.elements[this.elements.length - 1];
        }

        for (let index = this.elements.length - 1; index >= 0; --index) {
            const e = this.elements[index];
            if (e.localName === localName) {
                return e;
            }
        }

        return undefined;
    }

    Text(document: string, range: LandmarksRange) {
        
    }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix) {
        const qn = tag.getQualifiedName(document);
        let element: Element = { localName: qn.localName };
        this.elements.push(element);

        switch (element.localName) {
        }
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        const e = this.current()!;

        const qn = attribute.getQualifiedName(document);
        switch (qn.localName) {
        }
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        const e = this.current()!;

        if (tag.isSelfClosing) {
            // There won't be an EndTag to remove the item from the stack
            this.elements.pop();
        }
    }

    EndTag(document: string, tag: LandmarksEndTag) {
        if (tag.state === EndTagState.unmatched) {
            return;
        }

        // A matching end tag means we have a current element
        const e = this.current()!;

        this.elements.pop();
    }

    EndOfInput(document: string, open_elements: TagID[]) {
    }
}

export function feedToJSON(text: string) {
    const parser = LandmarksParser(xml);
    const handler = new Feed();
    parser.parse(text, handler);
    return handler.json;
}
