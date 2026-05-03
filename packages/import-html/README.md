# @templatical/import-html

Convert HTML email templates to Templatical format.

Designed for table-based marketing email HTML — output of MJML, Mailchimp/SendGrid/Campaign Monitor exports, hand-coded HTML emails. Modern (flex/grid) HTML is preserved via HTML-fallback blocks.

## Install

```sh
npm install @templatical/import-html
```

## Usage

```ts
import { convertHtmlTemplate } from '@templatical/import-html';

const html = await fetch('/path/to/email.html').then((r) => r.text());
const { content, report } = convertHtmlTemplate(html);

console.log(report.summary);
console.log(report.warnings);
```

See [Migration from HTML](https://docs.templatical.com/guide/migration-from-html) for the full element-mapping table.

## License

MIT
