// A simple TTML subtitle parser that converts TTML to WEBVTT
// We make some simplifying assumptions about which elements can appear
// by ignoring XML namespaces and just using the localName of interesting
// elements, by only handling color and not region/animation/metadata, by limiting the time format.

import { LandmarksHandler, BaseHandler } from "../landmarks-handler.js"
import { LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTag, LandmarksStartTag, LandmarksEndTagPrefix, TagID, EndTagState } from "../landmarks-parser-types.js";
import { LandmarksParser } from "../landmarks-parser.js";
import { xml } from "../landmarks-policy-ml.js";

function last(text: string) {
    return text[text.length - 1];
}

class LandmarksString {
    // text is normalized:
    // it won't start with whitespace
    // if it contains \n, it's deliberate; \n shouldn't be merged or ignored
    // space at the end can be merged or ignored
    private text: string = "";
    private trailingWhitespace: string = "";

    constructor(text: string) {
        this.append(text);
    }

    get value() {
        if (this.trailingWhitespace != " ") {
            return this.text + this.trailingWhitespace;
        }
        return this.text;
    }

    append(text: string) {
        if (text.length <= 0) {
            return;
        }

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

    // Use appendCloseTag if you want to add the close tag before any trailing whitespace
    // Otherwise just use append
    appendCloseTag(tag: string) {
        this.text += "</" + tag + ">";
        // If there was trailingWhitespace it's now after the tag
    }
}

type Style = { name: "style", id: string, color: string };
type Subtitle = { name: "p", start: string, end: string, style: string, color: string, content: LandmarksString };
type Span = { name: "span", style: string, color: string };
type Other = { name: "other", localName: string };
type Element = Style | Subtitle | Span | Other;

function padTime(time: string) {
    // WEBVTT has exactly 3-digit milliseconds, add zeroes if we have fewer digits
    var pieces = time.split(".");
    if ((pieces.length === 2) && (pieces[1].length < 3)) {
        return time + "0".repeat(3 - pieces[1].length);
    }
    return time;
}

class TTML extends BaseHandler {
    webVTT: string = "";

    private seenBody: boolean = false;

    private styles: Style[] = [];
    private subtitles: Subtitle[] = [];

    private currentSubtitle: Subtitle | undefined;

    private elements: Element[] = [];

    get currentElement(): Element {
        return this.elements[this.elements.length - 1];
    }

    Text(document: string, range: LandmarksRange) {
        if (this.currentSubtitle) {
            const text = range.getText(document);
            this.currentSubtitle.content.append(text);
        }
    }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix) {
        const qn = tag.getQualifiedName(document);
        let element: Element = { name: "other", localName: qn.localName };

        switch (qn.localName) {
            case "style":
                element = { name: "style", id: "", color: "" };
                this.styles.push(element);
                break;
            case "p":
                if (this.seenBody) {
                    element = { name: "p", start: "", end: "", style: "", color: "", content: new LandmarksString("") };
                    this.subtitles.push(element);
                    this.currentSubtitle = element;
                }
                break;
            case "span":
                element = { name: "span", style: "", color: "" };
                break;
            case "br":
                if (this.currentSubtitle) {
                    this.currentSubtitle.content.appendBreak();
                }
                break;
            case "body":
                this.seenBody = true;
                break;
        }
        this.elements.push(element);
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        const qn = attribute.getQualifiedName(document);
        const e = this.currentElement;
        if (e.name === "style") {
            switch (qn.localName) {
                case "id":
                    e.id = attribute.value.getText(document);
                    break;
                case "color":
                    e.color = attribute.value.getText(document);
                    break;
            }
        } else if (e.name === "p") {
            switch (qn.localName) {
                case "begin":
                    e.start = padTime(attribute.value.getText(document));
                    break;
                case "end":
                    e.end = padTime(attribute.value.getText(document));
                    break;
                case "color":
                    e.color = attribute.value.getText(document);
                    break;
                case "style":
                    e.style = attribute.value.getText(document);
                    const style = this.styles.find(style => style.id === e.style);
                    if (style) {
                        e.color = style.color;
                    }
                    break;
            }
        } else if (e.name === "span") {
            switch (qn.localName) {
                case "color":
                    e.color = attribute.value.getText(document);
                    break;
                case "style":
                    e.style = attribute.value.getText(document);
                    const style = this.styles.find(style => style.id === e.style);
                    if (style) {
                        e.color = style.color;
                    }
                    break;
            }
        }
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        const e = this.currentElement;
        if (e.name === "span") {
            if (e.color && this.currentSubtitle) {
                this.currentSubtitle.content.append(`<c.${e.color}>`);
            }
        }

        if (tag.isSelfClosing) {
            // There won't be an EndTag to remove the item from the stack
            this.elements.pop();
        }
    }

    EndTag(document: string, tag: LandmarksEndTag) {
        if (tag.state === EndTagState.unmatched) {
            return;
        }

        const e = this.currentElement;
        if (e.name === "span") {
            if (e.color && this.currentSubtitle) {
                this.currentSubtitle.content.appendCloseTag("c");
            }
        }

        if (this.currentSubtitle === this.currentElement) {
            this.currentSubtitle = undefined;
        }

        this.elements.pop();
    }

    EOF(document: string, open_elements: TagID[]) {
        const vtt = this.subtitles.map((subtitle, n) => {
            let styleStart = "";
            let styleEnd = "";
            if (subtitle.color && subtitle.color !== "white") {
                styleStart = `<c.${subtitle.color}>`;
                styleEnd = `</c>`;
            }
            return `${n + 1}\n${subtitle.start} --> ${subtitle.end}\n${styleStart}${subtitle.content.value}${styleEnd}\n\n`;
        });
        this.webVTT = "WEBVTT\n\n" + vtt.join("");
    }
}

export function ttmlToWebVTT(text: string) {
    const parser = LandmarksParser(xml);
    const handler = new TTML();
    parser.parse(text, handler);
    return handler.webVTT;
}