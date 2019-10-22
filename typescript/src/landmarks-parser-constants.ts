"use strict";

export function LandmarksParserConstants() {
    /*
     The space characters, for the purposes of this specification, are U+0020 SPACE, "tab" (U+0009), "LF" (U+000A), "FF" (U+000C), and "CR" (U+000D).
     http://www.w3.org/html/wg/drafts/html/master/single-page.html#space-character
     */
    const spaces = " \t\n\f\r";

    /*
     As in HTML5, a '/' in the middle of an attribute name creates a new attribute name and is not part of the name
     A '/' anywhere in an unquoted attribute value is part of the value (it doesn't create a new value or name and it is never part of a self-closing tag)
     */
    const attribute_spaces = spaces + "/";
    const attribute_name_end = attribute_spaces + ">=";
    const attribute_value_end = spaces + ">";

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
