// A simple TTML subtitle parser that converts TTML to WEBVTT
// We make some simplifying assumptions about which elements can appear
// by ignoring XML namespaces and just using the localName of interesting
// elements, by only handling color and not region/animation/metadata, by limiting the time format.

import { LandmarksHandler } from "../landmarks-handler"
import { LandmarksRange, LandmarksStartTagPrefix, LandmarksAttribute, LandmarksEndTag, LandmarksStartTag, LandmarksEndTagPrefix, TagID, EndTagState } from "../landmarks-parser-types";
import { LandmarksParser } from "../landmarks-parser";
import { xml } from "../landmarks-policy-ml";

type Style = { id: string, color: string };
type Subtitle = { start: string, end: string, style: string, color: string, content: string };
type Span = { color: string };
type Element = { name: string, data: Style | Subtitle | Span | undefined };

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
    private currentStyle: Style | undefined;

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
        const element: Element = { name: qn.localName, data: undefined };
        this.elements.push(element);
        switch (qn.localName) {
            case "style":
                element.data = { id: "", color: "" };
                this.styles.push(element.data);
                break;
            case "p":
                element.data = { start: "", end: "", style: "", color: "", content: "" };
                this.subtitles.push(element.data);
                this.currentSubtitle = element.data;
                break;
            case "span":
                element.data = { color: "" };
                break;
            case "br":
                if (this.currentSubtitle) {
                    this.currentSubtitle.content += "\n";
                }
                break;
        }
    }

    StartTagAttribute(document: string, attribute: LandmarksAttribute) {
        const qn = attribute.getQualifiedName(document);
        const e = this.currentElement;
        if (e.name === "style") {
            const style: Style = e.data as Style;
            switch (qn.localName) {
                case "id":
                    style.id = attribute.value.getText(document);
                    break;
                case "color":
                    style.color = attribute.value.getText(document);
                    break;
            }
        } else if (e.name === "p") {
            const subtitle: Subtitle = e.data as Subtitle;
            switch (qn.localName) {
                case "begin":
                    subtitle.start = padTime(attribute.value.getText(document));
                    break;
                case "end":
                    subtitle.end = padTime(attribute.value.getText(document));
                    break;
                case "style":
                    subtitle.style = attribute.value.getText(document);
                    const style = this.styles.find(style => style.id === subtitle.style);
                    if (style) {
                        subtitle.color = style.color;
                    }
                    break;
            }
        } else if (e.name === "span") {
            const span: Span = e.data as Span;
            switch (qn.localName) {
                case "color":
                    span.color = attribute.value.getText(document);
                    break;
            }

            if (span.color && this.currentSubtitle) {
                this.currentSubtitle.content += `<c.${span.color}>`;
            }
        }
    }

    StartTag(document: string, tag: LandmarksStartTag) {
        // Ignore
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
            const span: Span = e.data as Span;
            if (span.color && this.currentSubtitle) {
                this.currentSubtitle.content += `</c>`;
            }
        }

        if (this.currentSubtitle === this.currentElement.data) {
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