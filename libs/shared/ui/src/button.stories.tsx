import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./index";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Save draft", type: "button" },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { className: "secondary" } };
export const Disabled: Story = { args: { disabled: true } };
export const Interactive: Story = {
  render: function InteractiveButton(args) {
    const [count, setCount] = useState(0);
    return (
      <Button {...args} onClick={() => setCount(count + 1)}>
        Activated {count} times
      </Button>
    );
  },
};
