declare module 'mjml' {
  interface MjmlResult {
    html: string;
    errors: Array<{
      line: number;
      message: string;
      tagName: string;
      formattedMessage: string;
    }>;
  }

  function mjml2html(mjml: string, options?: Record<string, unknown>): MjmlResult;

  export default mjml2html;
}
