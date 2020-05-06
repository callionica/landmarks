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

type Element = { prefix: string, localName: string, item?: any, channel?: any };;

interface FeedHandler {
    Channel(channel: any): void;
    Item(item: any): void;
}

class Feed extends BaseHandler {
    feedHandler: FeedHandler;

    private elements: Element[] = [];

    constructor(feedHandler: FeedHandler) {
        super();
        this.feedHandler = feedHandler;
    }

    cleanupTag() {
        let c = this.current();
        let item = c && c.item;
        if (item) {
            this.feedHandler.Item(item);
        } else {
            let channel = c && c.channel;
            if (channel) {
                this.feedHandler.Channel(channel);
            }
        }

        this.elements.pop();
    }

    get path(): string {
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

    CData(document: string, range: LandmarksRange) {
        // We can do this because getDecodedText works nicely for CData ranges
        this.Text(document, range);
    }

    Text(document: string, range: LandmarksRange) {
        let i = this.current("item");
        let item = i && i.item;

        if (item) {
            let props = ["title", "subtitle", "pubDate", "duration", "link", "guid"];
            for (let prop of props) {
                if (this.current(prop)) {
                    item[prop] = range.getDecodedText(document);
                }
            }
        } else {
            let c = this.current("channel");
            let channel = c && c.channel;
            if (channel) {
                let props = ["title", "subtitle", "pubDate"];
                for (let prop of props) {
                    if (this.current(prop)) {
                        channel[prop] = range.getDecodedText(document);
                    }
                }
            }
        }
    }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix) {
        const qn = tag.getQualifiedName(document);
        let element: Element = { ...qn };
        this.elements.push(element);

        switch (element.localName) {
            case "item":
                element.item = { enclosure: {} };
                break;
            case "channel":
                element.channel = {};
                break;
        }
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        let i = this.current("item");
        let item = i && i.item;

        const e = this.current()!;
        const qn = attribute.getQualifiedName(document);

        if (item && e.localName === "enclosure") {
            item.enclosure[qn.localName] = attribute.value.getDecodedText(document);
        }
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        const e = this.current()!;

        if (tag.isSelfClosing) {
            // There won't be an EndTag to remove the item from the stack
            this.cleanupTag();
        }
    }

    EndTag(document: string, tag: LandmarksEndTag) {
        if (tag.state === EndTagState.unmatched) {
            return;
        }

        // A matching end tag means we have a current element
        const e = this.current()!;

        this.cleanupTag();
    }

    EndOfInput(document: string, open_elements: TagID[]) {
    }
}

export function feedToJSON(text: string) {
    const maximumItems = 100;
    const hndlr = {
        channel: {} as any,
        items: [] as any[],
        Channel(channel: any) {
            channel = channel;
        },
        Item(item: any): void {
            this.items.push(item);
            if (this.items.length === maximumItems) {
                throw this;
            }
        }
    };
    const parser = LandmarksParser(xml);
    const handler = new Feed(hndlr);
    try {
        parser.parse(text, handler);
    } catch (e) {
        if (e === hndlr) {
            // expected - early exit when we reached maximumItems
        } else {
            throw e;
        }
    }
    return JSON.stringify({ channel: hndlr.channel, items: hndlr.items }, null, 2);
}
