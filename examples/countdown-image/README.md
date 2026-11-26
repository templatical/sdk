# Countdown image endpoint

This Node server turns a `CountdownBlock` URL into a GIF for an email image. It uses one bundled font for every label; the block's `fontFamily` is not read. `assets/NotoSansJP-subset.ttf` is Noto Sans JP cut down to printable ASCII and the characters of the SDK's default countdown labels and expired messages in its supported locales, so the file stays small. Characters outside that set draw as empty boxes: to use other labels, replace the file with a font that covers them. The font is licensed under the SIL Open Font License in [`assets/OFL.txt`](assets/OFL.txt).

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:21746/countdown.gif?targetDate=2030-12-24T18%3A00&timezone=Europe%2FBerlin`. Set `PORT` to change the port. `npm run build`, `npm run typecheck`, and `npm start` exercise the compiled server.

Pass the countdown block's image fields as query parameters from `imageUrl(block)`. Booleans are `true` or `false`; omitted fields use `createCountdownBlock()` defaults. The GIF plays once: 60 one-second frames, then its last frame remains. An already expired target returns one frame; `hideOnExpiry=true` returns one transparent pixel. The server returns 400 for invalid dates, timezones, or values outside its limits.

Limits: the query string is at most 2,048 characters; dates are from 2000 through 2100; labels are at most 32 characters each; the expiry message is at most 100 characters; font sizes are clamped to 8–72 px for digits and 8–32 px for labels. Colors must be hexadecimal RGB (`#rgb` or `#rrggbb`). The public cache lifetime is one second so a newly opened image does not lag by a full minute.

This example reads public query parameters. For production, follow the [guide's block lookup and signed URL patterns](https://docs.templatical.com/guide/countdown#image-endpoint-security), including private, uncached editor previews. Never fetch `expiredImageUrl` from this endpoint.
