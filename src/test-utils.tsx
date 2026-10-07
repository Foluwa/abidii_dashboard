import React from "react";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider } from "@/context/ThemeContext";

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}

import userEvent from "@testing-library/user-event";
import { screen as tlScreen, waitFor as tlWaitFor } from "@testing-library/react";

type User = ReturnType<typeof userEvent.setup> | typeof userEvent;

/**
 * Picks an option from a custom (Radix) dropdown - the dashboard renders no
 * native <select> menus, so `userEvent.selectOptions` no longer applies.
 * Opens the trigger like a user would and clicks the option matching
 * `valueOrLabel` by its data-value, falling back to its visible label.
 */
export async function chooseOption(
  user: User,
  trigger: HTMLElement,
  valueOrLabel: string,
): Promise<void> {
  await user.click(trigger);
  const option = await tlWaitFor(() => {
    const byValue = document.querySelector<HTMLElement>(
      `[role="option"][data-value="${valueOrLabel.replace(/"/g, "\\\"")}"]`,
    );
    return byValue ?? tlScreen.getByRole("option", { name: valueOrLabel });
  });
  await user.click(option);
}
