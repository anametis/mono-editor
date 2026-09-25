import type { Preview } from "@storybook/react-vite";
import "@kara/tokens/styles.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
};
export default preview;
