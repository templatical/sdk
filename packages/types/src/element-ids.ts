import type { Block } from "./blocks";
import type { TemplateContent } from "./template";

/** Element ids containing "." or "/", depth first, with their template paths. Pure. */
export function elementIdIssues(
  content: TemplateContent,
): { path: string; id: string }[] {
  const issues: { path: string; id: string }[] = [];
  const check = (id: unknown, path: string) => {
    if (typeof id === "string" && /[./]/.test(id)) issues.push({ path, id });
  };
  const visit = (blocks: Block[], path: string) => {
    if (!Array.isArray(blocks)) return;
    blocks.forEach((block, i) => {
      if (!block || typeof block !== "object") return;
      const where = `${path}[${i}]`;
      if (block.type === "menu" && Array.isArray(block.items)) {
        block.items.forEach((item, j) =>
          check(item?.id, `${where}.items[${j}].id`),
        );
      } else if (block.type === "social" && Array.isArray(block.icons)) {
        block.icons.forEach((icon, j) =>
          check(icon?.id, `${where}.icons[${j}].id`),
        );
      } else if (block.type === "table" && Array.isArray(block.rows)) {
        block.rows.forEach((row, j) => {
          const rowPath = `${where}.rows[${j}]`;
          check(row?.id, `${rowPath}.id`);
          if (Array.isArray(row?.cells)) {
            row.cells.forEach((cell, k) =>
              check(cell?.id, `${rowPath}.cells[${k}].id`),
            );
          }
        });
      } else if (block.type === "section" && Array.isArray(block.children)) {
        block.children.forEach((column, j) =>
          visit(column, `${where}.children[${j}]`),
        );
      } else if (block.type === "wrapper") {
        visit(block.children, `${where}.children`);
      }
    });
  };
  visit(content.blocks, "blocks");
  return issues;
}
