// ALL RIGHTS RESERVED

// A simple RSS podcast feed parser that converts RSS to JSON
// This example demonstrates early exit
//
// The parser pulls data from RSS and iTunes tags to get data about podcasts.
// It handles both HTML and CDATA properties and removes the HTML from all of them
// to produce plain text.
//
// "feedToJSON(string) : string" converts an RSS feed string to JSON

import { LandmarksHandler, BaseHandler } from "../landmarks-handler.js"
import { LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTag, LandmarksStartTag, LandmarksEndTagPrefix, TagID, EndTagState } from "../landmarks-parser-types.js";
import { LandmarksParser } from "../landmarks-parser.js";
import { xml, html5 } from "../landmarks-policy-ml.js";
import { encodeEntities, decodeEntities } from "../landmarks-entities.js";
import { LandmarksPolicy } from "../landmarks-policy.js";

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

    // The result does not include any trailing whitespace and is decoded
    get decoded() {
        return decodeEntities(this.trimmed);
    }

    // Encodes the passed text and normalizes the whitespace
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

    // Appends a line break \n
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

// Removes HTML tags/attributes while preserving text
// Assumes whitespace should be normalized
// Does a small amount of tag->whitespace adjustment
// e.g. p, br, hr all produce \n
class TagRemover extends BaseHandler {
    text: LandmarksString;

    private elements: Element[] = [];

    constructor() {
        super();
        this.text = new LandmarksString("");
    }

    closeTag() {
        const e = this.current()!;
        if (["p","br","hr", "tr"].includes(e.localName)) {
            this.text.appendBreak();
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
    }

    Text(document: string, range: LandmarksRange) {
        this.text.append(range.getDecodedText(document));
    }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix) {
        const qn = tag.getQualifiedName(document);
        let element: Element = { ...qn };
        this.elements.push(element);
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        const e = this.current()!;
        const qn = attribute.getQualifiedName(document);
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        const e = this.current()!;

        if (tag.isSelfClosing) {
            // There won't be an EndTag to remove the item from the stack
            this.closeTag();
        }
    }

    EndTag(document: string, tag: LandmarksEndTag) {
        if (tag.state === EndTagState.unmatched) {
            // There wasn't a StartTagPrefix to push the item on the stack
            return;
        }

        // A matching end tag means we have a current element
        const e = this.current()!;

        this.closeTag();
    }

    EndOfInput(document: string, open_elements: TagID[]) {
    }
}

function stripTags(text: string, policy: LandmarksPolicy = html5) {
    const parser = LandmarksParser(policy);
    const handler = new TagRemover();
    parser.parse(text, handler);
    return handler.text.decoded;
}

type Item = any;
type Channel = { sent: boolean, data: any };
type Element = { prefix: string, localName: string, item?: Item, channel?: Channel };

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

    // Returns the current item if there is one
    get item(): any | undefined {
        let c = this.current("item");
        return c && c.item;
    }

    // Returns the current channel if there is one
    get channel(): Channel | undefined {
        let c = this.current("channel");
        return c && c.channel;
    }

    cleanupTag() {
        let c = this.current();
        let item = c && c.item;
        if (item) {
            // Send the channel before sending the first item
            let channel = this.channel;
            if (channel && !channel.sent) {
                channel.sent = true;
                this.feedHandler.Channel(channel.data);
            }
            this.feedHandler.Item(item);
        } else {
            // Send the channel if there are no items
            let channel = c && c.channel;
            if (channel && !channel.sent) {
                channel.sent = true;
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
        // We can do this because LandmarksRange.getDecodedText works nicely for CData ranges
        this.Text(document, range);
    }

    Text(document: string, range: LandmarksRange) {
        let item = this.item;

        if (item !== undefined) {
            let props = ["title", "description", "subtitle", "summary", "pubDate", "duration", "link", "guid"];
            for (let prop of props) {
                if (this.current(prop)) {
                    item[prop] = stripTags(range.getDecodedText(document));
                }
            }
        } else {
            let channel = this.channel;
            if (channel !== undefined) {
                let props = ["title", "description", "subtitle", "summary", "pubDate"];
                for (let prop of props) {
                    if (this.current(prop)) {
                        channel.data[prop] = stripTags(range.getDecodedText(document));
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
                element.channel = { sent: false, data: {} };
                break;
        }
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        const e = this.current()!;
        const qn = attribute.getQualifiedName(document);

        let item = this.item;
        if (item) {
            if (e.localName === "enclosure") {
                item.enclosure[qn.localName] = attribute.value.getDecodedText(document);
            } else if (e.localName === "image" && qn.localName === "href") {
                item.image = attribute.value.getDecodedText(document);
            }
        } else {
            let channel = this.channel;
            if (channel) {
                if (e.localName === "image" && qn.localName === "href") {
                    channel.data.image = attribute.value.getDecodedText(document);
                }
            }
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

export function feedToJSON(text: string, maximumItems: number = -1) {
    const feedHandler = {
        channel: {} as any,
        items: [] as any[],
        Channel(channel: any) {
            this.channel = channel;
        },
        Item(item: any): void {
            this.items.push(item);
            if (this.items.length === maximumItems) {
                throw this;
            }
        }
    };
    const parser = LandmarksParser(xml);
    const landmarksHandler = new Feed(feedHandler);
    try {
        parser.parse(text, landmarksHandler);
    } catch (e) {
        if (e === feedHandler) {
            // expected - early exit when we reached maximumItems
        } else {
            throw e;
        }
    }
    return JSON.stringify({ channel: feedHandler.channel, items: feedHandler.items }, null, 2);
}
