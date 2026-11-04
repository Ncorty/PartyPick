# Font sources and limitations

## Not A Bug Regular

- Designer: Ömer Faruk Pehlivan.
- Primary source: https://github.com/omerfrkphlvn/Not-A-Bug
- Font file: `fonts/ttf/NotABug-Regular.ttf` from the upstream repository.
- Included unchanged as `not-a-bug-regular.ttf`.
- License: SIL Open Font License 1.1; full upstream copyright and license in
  `not-a-bug-LICENSE.txt`. Web embedding and redistribution with the license are permitted.
- The downloaded font's cmap was inspected. It contains Latin letters and punctuation,
  but no Cyrillic. Use for the English PartyPick wordmark or Latin labels; do not
  describe it as the font rendering Russian interface text.

## Modula — not bundled

The requested Modula is AlphabetFan2014's 2026 pixel font, not Emigre's unrelated
typeface with the same name.

- Primary source: https://www.fontstruct.com/fontstructions/show/2975272/modula-15
- Primary license: https://www.fontstruct.com/fontstructions/license/2975272/modula-15
- FontStruct Non-Commercial EULA 1.0 sections 2.3 and 2.6 prohibit redistribution
  and webfont use respectively. Personal use explicitly excludes webfont use.
- No Modula font file is bundled or served. A separate permission from its designer
  is needed before using it as a self-hosted webfont.

## Retrogression — not bundled

- Designer: slnc.
- Designer's showcase: https://www.behance.net/gallery/103580903/retrogression-free-font
- Requested listing: https://fonts-online.ru/fonts/retrogression
- The showcase calls it free but provides no explicit web-embedding terms.
  Aggregators disagree about commercial permissions. The downloadable TTF's
  metadata does not include a license. Pixel Surplus lists a separate paid webfont
  license: https://pixelsurplus.com/products/retrogression-free-font
- No Retrogression font file is bundled or served pending explicit webfont permission.

## Pixelify Sans — explicit Cyrillic fallback

- Added as an explicit fallback because Not A Bug has no Cyrillic, Modula forbids
  web embedding, and Retrogression's web rights remain unverified.
- Designer/project: The Pixelify Sans Project Authors; upstream
  https://github.com/eifetx/Pixelify-Sans
- Distribution source: https://github.com/google/fonts/tree/main/ofl/pixelifysans
- Downloaded unchanged `PixelifySans[wght].ttf` as `pixelify-sans-variable.ttf`.
- License: SIL Open Font License 1.1, including web embedding and redistribution;
  complete upstream copyright and license in `pixelify-sans-LICENSE.txt`.
- Variable weights 400–700. The font's cmap was checked for the entire modern
  Russian alphabet (including Ё/ё), Latin PartyPick letters and digits. The
  distributed font unexpectedly lacks uppercase Cyrillic О (U+041E) and П
  (U+041F), despite the upstream metadata declaring the Cyrillic subset.
  A complete pixel font must follow it in the CSS fallback stack.

## Tiny5 — complete Cyrillic safety fallback

- Source: https://github.com/google/fonts/tree/main/ofl/tiny5
- Downloaded unchanged `Tiny5[BLED,JITT,ROND,wdth,wght].ttf` as `tiny5-variable.ttf`.
- License: SIL Open Font License 1.1; full copyright and license in `tiny5-LICENSE.txt`.
- The font's cmap covers every modern Russian alphabet letter including Ё/ё,
  Latin PartyPick letters and digits. It can fill the missing glyphs in Pixelify
  Sans without falling back to a smooth system font.

Checked 2026-11-04. These notes distinguish available files and verified terms from
the desired visual choice; they are not a substitute for the license itself.
