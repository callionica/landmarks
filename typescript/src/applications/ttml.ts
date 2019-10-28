// A simple TTML subtitle parser that converts TTML to WEBVTT
//
// "ttmlToWebVTT(string) : string" converts a TTML string to a WebVTT string
//
// We make some simplifying assumptions about the input TTML:
// 1. We can ignore XML namespaces and just use localName to recognize the interesting elements
// 2. We can ignore region/animation/audio/language/metadata and only handle color (applied directly or through a style; and only text color, not background color)
// 3. We can assume that colors are provided as named colors (that would be valid as CSS class names)
// 4. We can ignore any style information applied on "body", "div", "region" elements and assume that all styles & colors are applied on "p" or "span" elements
// 5. We can ignore "xml:space" attributes and treat content as "xml:space=default"
// 6. We can assume that timing information is supplied in "begin" and "end" attributes on "p" elements (not "dur" attributes and not on other elements)
// 7. We can assume that the time code is HMS (but if it's SMPTE we'll convert by assuming 25 frames per second)
// 8. We can assume that the timing information is ordered sequentially in a way that aligns with WebVTT rules
// 9. We can rely on the input document being valid or, if invalid, we don't care to be informed
// 10. We assume "style" elements are self-contained and do not reference other "style" elements
//
// For the output:
// 1. We number each cue instead of using the xml:id from the input document
// 2. We resolve styles to colors and then use class names named after the color <c.color></c>
// 3. We move tags so that significant whitespace does not appear directly before a closing tag
// Ex: "<c.blue>blue</c> white" not "<c.blue>blue </c>white"
// 4. We remove any significant trailing whitespace from a cue
// 5. We omit a cue class if it covers the entire cue and is for color "white"
//
// Keywords: TTML parser, TTML to VTT, TTML to WebVTT, TTML subtitles, subtitle parser, TTML converter
//
// An interesting document: http://w3c.github.io/ttml-webvtt-mapping/

import { LandmarksHandler, BaseHandler } from "../landmarks-handler.js"
import { LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTag, LandmarksStartTag, LandmarksEndTagPrefix, TagID, EndTagState } from "../landmarks-parser-types.js";
import { LandmarksParser } from "../landmarks-parser.js";
import { xml } from "../landmarks-policy-ml.js";

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
type Subtitle = { name: "p", begin: string, end: string, style: string, color: string, content: LandmarksString };
type Span = { name: "span", style: string, color: string };
type Other = { name: "other", localName: string };
type Element = Style | Subtitle | Span | Other;

function webvttTime(time: string) {
    const hms = /^((?<h>\d{1,2}):)?(?<m>\d{1,2}):(?<s>\d{1,2})([.](?<ms>\d{1,3}))?$/ig;
    let match: any = hms.exec(time);

    let ms = "000";
    if (!match) {
        const smpte = /^(?<h>\d{2}):(?<m>\d{2}):(?<s>\d{2}):(?<f>\d{2})$/ig;
        match = smpte.exec(time);
        if (!match) {
            return time;
        }
        const frame = parseInt(match.groups.f, 10);
        // TODO framerate
        const framesPerSecond = 25;
        let fraction = 1000 * frame/framesPerSecond;
        if (fraction >= 1000) {
            fraction = 0;
        }
        ms = last("000" + fraction, 3);
    } else {
        ms = first(match.groups.ms + "000", 3);
    }
    
    let h = match.groups.h || "00";
    let m = match.groups.m || "00";
    let s = match.groups.s || "00";
    return `${h}:${m}:${s}.${ms}`;
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
                    element = { name: "p", begin: "", end: "", style: "", color: "", content: new LandmarksString("") };
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
                case "color":
                    e[qn.localName] = attribute.value.getText(document);
                    break;
            }
        } else if (e.name === "p") {
            switch (qn.localName) {
                case "begin":
                case "end":
                case "color":
                    e[qn.localName] = attribute.value.getText(document);
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
            return `${n + 1}\n${webvttTime(subtitle.begin)} --> ${webvttTime(subtitle.end)}\n${styleStart}${subtitle.content.trimmed}${styleEnd}\n\n`;
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

const ttmlToVTT = ttmlToWebVTT; // Search optimisation
