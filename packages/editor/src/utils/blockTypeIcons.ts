import {
  Code,
  Columns3,
  Image,
  Minus,
  MoveVertical,
  Navigation,
  Play,
  RectangleHorizontal,
  Share2,
  Table,
  Timer,
  Type,
} from "lucide-vue-next";
import type { Component } from "vue";

export const blockTypeIcons: Record<string, Component> = {
  section: Columns3,
  image: Image,
  text: Type,
  button: RectangleHorizontal,
  divider: Minus,
  video: Play,
  social: Share2,
  menu: Navigation,
  table: Table,
  spacer: MoveVertical,
  countdown: Timer,
  html: Code,
};
