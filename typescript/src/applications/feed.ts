// ALL RIGHTS RESERVED

// A simple TTML subtitle parser that converts TTML to WEBVTT
//
// "ttmlToWebVTT(string) : string" converts a TTML string to a WebVTT string
//
// We make some simplifying assumptions about the input TTML:
// 1. We can ignore XML namespaces and just use localName to recognize the interesting elements
// 2. We can ignore region/animation/audio/language/metadata and only handle color (applied directly or through a style; and only text color, not background color)
// 3. We can assume that colors are provided as named colors that would be valid as CSS class names (or as one of a few hex colors which we map to names)
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

function nameColor(color: string) : string {

    const colors : { [index: string]: string | undefined; } = {
        "#FFFFFF" : "white",
        "#000000" : "black",
        "#FFFF00" : "yellow",
        "#FF00FF" : "magenta",
        "#00FFFF" : "cyan",
        "#FF0000" : "red",
        "#00FF00" : "green",
        "#0000FF" : "blue",
    };

    const found = colors[color.toUpperCase()];
    if (found) {
        return found;
    }
    return color;
}

type E = { localName: string, content?: LandmarksString };
type A = { id?: string, style?: string, color?: string, begin?: string, end?: string };
type Element = E & A;
type Subtitle = Element & { content: LandmarksString };

function webvttTime(time: string, framesPerSecond: number = 25) {
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
        let fraction = 1000 * frame / framesPerSecond;
        if (fraction >= 1000) {
            // Maybe frames per second is wrong
            fraction = 999;
        }
        ms = last("000" + fraction, 3);
    } else {
        ms = first((match.groups.ms || "000") + "000", 3);
    }

    let h = match.groups.h || "00";
    let m = match.groups.m || "00";
    let s = match.groups.s || "00";
    return `${h}:${m}:${s}.${ms}`;
}

type Cue = {
    id : string;
    startTime : string;
    endTime : string;
    text : string;
};

class TTML extends BaseHandler {
    webVTT: string = "";

    private styles: Element[] = [];
    private subtitles: Subtitle[] = [];

    private elements: Element[] = [];

    private cues: Cue[] = [];

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
        const subtitle = this.current("p");
        if (subtitle && subtitle.content) {
            const text = range.getDecodedText(document);
            subtitle.content.append(text);
        }
    }

    StartTagPrefix(document: string, tag: LandmarksStartTagPrefix) {
        const qn = tag.getQualifiedName(document);
        let element: Element = { localName: qn.localName };
        this.elements.push(element);

        switch (element.localName) {
            case "style":
                this.styles.push(element);
                break;
            case "p":
                if (this.current("body")) {
                    element.content = new LandmarksString("");
                    this.subtitles.push(element as Subtitle);
                }
                break;
            case "br":
                const subtitle = this.current("p");
                if (subtitle && subtitle.content) {
                    subtitle.content.appendBreak();
                }
                break;
        }
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        const e = this.current()!;

        const qn = attribute.getQualifiedName(document);
        switch (qn.localName) {
            case "color":
                    e[qn.localName] = nameColor(attribute.value.getText(document));
                    break;
            case "id":
            case "style":
            case "begin":
            case "end":
                e[qn.localName] = attribute.value.getText(document);
                break;
        }
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        const e = this.current()!;

        if ((e.localName === "span" || e.localName === "p") && e.style) {
            const style = this.styles.find(style => style.id === e.style);
            if (style && style.color) {
                e.color = style.color;
            }
        }

        if (e.localName === "span" && e.color) {
            const subtitle = this.current("p");
            if (subtitle && subtitle.content) {
                subtitle.content.appendOpenTag(`c.${e.color}`);
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

        // A matching end tag means we have a current element
        const e = this.current()!;

        if (e.localName === "span" && e.color) {
            const subtitle = this.current("p");
            if (subtitle && subtitle.content) {
                subtitle.content.appendCloseTag("c");
            }
        }

        this.elements.pop();
    }

    EndOfInput(document: string, open_elements: TagID[]) {
        this.cues = this.subtitles.map((subtitle, n) => {
            let styleStart = "";
            let styleEnd = "";
            const color = subtitle.color;
            if (color && (color !== "white")) {
                styleStart = `<c.${color}>`;
                styleEnd = `</c>`;
            }
            return {
                id: `${n + 1}`,
                startTime: webvttTime(subtitle.begin!),
                endTime: webvttTime(subtitle.end!),
                text: `${styleStart}${subtitle.content.trimmed}${styleEnd}`
            };
        });
        const vtt = this.cues.map(cue => {
            return `${cue.id}\n${cue.startTime} --> ${cue.endTime}\n${cue.text}\n\n`;
        });
        this.webVTT = "WEBVTT\n\n" + vtt.join("");
    }
}

export function feedToHTML(text: string) {
    const parser = LandmarksParser(xml);
    const handler = new TTML();
    parser.parse(text, handler);
    return handler.webVTT;
}
