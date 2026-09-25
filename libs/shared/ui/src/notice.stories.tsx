import type { Meta, StoryObj } from "@storybook/react-vite";
import { Notice } from "./index";
const meta = {
  title: "UI/Notice",
  component: Notice,
  args: { children: "Your changes have been saved." },
} satisfies Meta<typeof Notice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Status: Story = {};
export const Error: Story = {
  args: { error: true, children: "Unable to save. Please try again." },
};
