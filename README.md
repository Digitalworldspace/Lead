# Style Of Life — AI Shopping (fixed)

This version fixes the JavaScript regex bug that caused searches such as "Bracelet" to fail.

Fixed:
- Budget parsing (`under $500`, etc.)
- Search-word parsing
- Amazon affiliate tab target
- Search works from button, Enter, and quick-search buttons

Important:
- Current product cards are demo/sample data.
- Amazon links use the Partner Tag `styleoflife08-21`.
- Live Amazon product data requires approved Amazon Associates / Creators API access.
- Never put Amazon API secrets in public frontend code.
