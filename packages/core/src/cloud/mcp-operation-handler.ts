import type { TemplateOperationPayload } from "@templatical/types";
import type {
  Block,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
import type { UseEditorReturn } from "../editor";

export function handleOperation(
  editor: UseEditorReturn,
  payload: TemplateOperationPayload,
): void {
  const { operation, data } = payload;

  switch (operation) {
    case "addBlock":
      editor.addBlock(
        data.block as Block,
        data.sectionId as string | undefined,
        data.columnIndex as number | undefined,
        data.index as number | undefined,
      );
      break;

    case "updateBlock":
      editor.updateBlock(
        data.blockId as string,
        data.updates as Partial<Block>,
      );
      break;

    case "deleteBlock":
      editor.removeBlock(data.blockId as string);
      break;

    case "moveBlock":
      editor.moveBlock(
        data.blockId as string,
        data.index as number,
        data.sectionId as string | undefined,
        data.columnIndex as number | undefined,
      );
      break;

    case "updateSettings":
      editor.updateSettings(data.updates as Partial<TemplateSettings>);
      break;

    case "setContent":
      editor.setContent(data.content as TemplateContent);
      break;

    case "updateBlockStyle":
      editor.updateBlock(
        data.blockId as string,
        {
          styles: data.styles,
        } as Partial<Block>,
      );
      break;
  }
}
