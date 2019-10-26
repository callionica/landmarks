// A simple TTML subtitle parser that converts TTML to WEBVTT
// We make some simplifying assumptions about which elements can appear
// by ignoring XML namespaces and just using the localName of interesting
// elements, by only handling color and not region/animation/metadata, by limiting the time format.

import { LandmarksHandler } from "../landmarks-handler.js"
import { LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTag, LandmarksStartTag, LandmarksEndTagPrefix, TagID, EndTagState } from "../landmarks-parser-types.js";
import { LandmarksParser } from "../landmarks-parser.js";
import { xml } from "../landmarks-policy-ml.js";

type Style = { name: "style", id: string, color: string };
type Subtitle = { name: "p", start: string, end: string, style: string, color: string, content: string };
type Span = { name: "span", color: string };
type Other = { name: "other", localName: string };
type Element = Style | Subtitle | Span | Other;

function padTime(time : string) {
    // WEBVTT has exactly 3-digit milliseconds, add zeroes if we have fewer digits
    var pieces = time.split(".");
    if ((pieces.length === 2) && (pieces[1].length < 3)) {
        return time + "0".repeat(3 - pieces[1].length);
    }
    return time;
}

class TTML implements LandmarksHandler {
    webVTT: string = "";

    private styles: Style[] = [];
    private subtitles: Subtitle[] = [];

    private currentSubtitle: Subtitle | undefined;

    private elements: Element[] = [];

    get currentElement(): Element {
        return this.elements[this.elements.length - 1];
    }

    Text(document: string, range: LandmarksRange) {
        if (this.currentSubtitle) {
            this.currentSubtitle.content += range.getText(document);
        }
    }

    Comment(document: string, range: LandmarksRange) {
        // Ignore
    }

    CData(document: string, range: LandmarksRange) {
        // Ignore
    }

    Processing(document: string, range: LandmarksRange) {
        // Ignore
    }

    Declaration(document: string, range: LandmarksRange) {
        // Ignore
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
                element = { name: "p", start: "", end: "", style: "", color: "", content: "" };
                this.subtitles.push(element);
                this.currentSubtitle = element;
                break;
            case "span":
                element = { name: "span", color: "" };
                break;
            case "br":
                if (this.currentSubtitle) {
                    this.currentSubtitle.content += "\n";
                }
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
            }

            if (e.color && this.currentSubtitle) {
                this.currentSubtitle.content += `<c.${e.color}>`;
            }
        }
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        if (tag.isSelfClosing) {
            // There won't be an EndTag to remove the item from the stack
            this.elements.pop();
        }
    }

    EndTagPrefix(document: string, tag: LandmarksEndTagPrefix) {
        // Ignore
    }

    EndTagAttribute(document: string, attribute: LandmarksAttribute) {
        // Ignore
    }

    EndTag(document: string, tag: LandmarksEndTag) {
        if (tag.state === EndTagState.unmatched) {
            return;
        }

        const e = this.currentElement;
        if (e.name === "span") {
            if (e.color && this.currentSubtitle) {
                this.currentSubtitle.content += `</c>`;
            }
        }

        if (this.currentSubtitle === this.currentElement) {
            this.currentSubtitle = undefined;
        }

        this.elements.pop();
    }

    EOF(document: string, open_elements: TagID[]) {
        const vtt = this.subtitles.map((subtitle, n) => {
            let wrapStart = "";
            let wrapEnd = "";
            if (subtitle.color) {
                wrapStart = `<c.${subtitle.color}>`;
				wrapEnd = `</c>`;
            }
            return `${n+1}\n${subtitle.start} --> ${subtitle.end}\n${wrapStart}${subtitle.content}${wrapEnd}\n\n`;
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