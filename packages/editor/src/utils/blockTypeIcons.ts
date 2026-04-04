import {
  Code,
  Columns3,
  Heading,
  Image,
  Minus,
  MoveVertical,
  Navigation,
  Pilcrow,
  Play,
  RectangleHorizontal,
  Share2,
  Table,
  Timer,
  Type,
} from "@lucide/vue";
import type { Component } from "vue";

export const blockTypeIcons: Record<string, Component> = {
  section: Columns3,
  title: Heading,
  paragraph: Pilcrow,
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
