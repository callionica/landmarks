# Landmarks
Landmarks is a customizable parser for HTML, XML, and other similar structured languages.

It is delivered as C++ source code that can be simply integrated with your project.

Landmarks is a complete, standalone implementation of a markup language parser using standard C++.

Landmarks is not a wrapper for any other library and its code is not based on any other parser.

Landmarks' implementation is informed by the HTML5 specification, making it an ideal choice to quickly extract information from HTML documents. However, Landmarks is deliberately not an HTML5-conformant parser. Landmarks does not execute script in the documents that it parses, it does not implement some of the more esoteric behavior of HTML5 parsers that web standards committees demand for compatibility, and it preserves more information from the source document in some cases where HTML browsers obscure the true structure of the input.

The Landmarks parser supports the following features:

## 1. Content can contain < and >
HTML and Landmarks can interpret angle brackets as literal text depending on context. XML parsers cannot.

## 2. Attributes do not have to have values
HTML and Landmarks do not require each attribute to have a value. XML parsers do require attribute values.

## 3. Attribute values do not have to be quoted
HTML and Landmarks do not require simple attribute values to be contained in quotes. XML parsers require attribute values to be within quotes.

## 4. Attribute values can be in single quotes
HTML and Landmarks can recognize attribute values contained in single quotes. XML parsers require attribute values to be within double quotes.

## 5. Attribute values can be in double quotes
HTML, Landmarks, and XML parsers all recognize attribute values contained in double quotes.

## 6. Attributes on end tags
Landmarks supports attributes on closing tags and delivers that info to the application. HTML requires attributes on closing tags to be parsed, but ignored. XML does not support attributes on closing tags.

## 7. Duplicate attributes
Landmarks supports multiple attributes with the same name on a single element and delivers that info to the application. HTML ignores subsequent attributes that have the same name as an earlier attribute. XML does not support duplicate attributes.

## 8. Void elements
HTML says that certain specific elements can never contain content and that a start tag `<X>` must be treated as a self-closing element `<X/>` even if the slash is missing. Landmarks supports this feature and allows you to customize which elements are treated this way. XML does not have this feature.

## 9. Content elements
HTML says that certain specific elements must always contain content and that a self-closing element `<X/>` must instead be treated as a start tag `<X>`. Landmarks supports this feature and allows you to customize which elements are treated this way. XML does not have this feature.

## 10. Opaque elements
Opaque elements are ones where once a start tag is seen, the following text is simply scanned until the matching end tag is seen. This means that any content within the element is not parsed separately. HTML says that certain specific elements must be treated this way (although it also adds additional backward compatibility parsing requirements in some cases). Landmarks supports this feature and allows you to customize which elements are treated this way. XML does not have this feature.

## 11. Autoclose by parent end
HTML says for certain specific elements that if the end tag is missing, the end tag is synthesized during parsing when the parent element is closed. Landmarks supports this feature and allows you to customize which elements are treated this way. XML does not have this feature.

## 12. Autoclose by sibling start
HTML says for certain specific elements that if the end tag is missing, the end tag is synthesized during parsing when certain specific sibling elements are opened. Landmarks supports this feature and allows you to customize which elements are treated this way. XML does not have this feature.

## 13. Autoclosing end tags
Landmarks allows you to customize elements such that when they are closed, the parser will automatically synthesize end tags for any open child elements. Neither HTML nor XML has this feature.

## 14. Automatching end tags
Landmarks allows you to control whether an end tag seen by the parser is an automatching end tag, meaning that it will match the start tag of any open element. Neither HTML nor XML has this feature.


