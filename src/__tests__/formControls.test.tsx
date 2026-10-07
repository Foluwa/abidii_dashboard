import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StyledSelect } from "@/components/ui/form/StyledSelect";
import { Combobox } from "@/components/ui/form/Combobox";
import { Modal } from "@/components/ui/modal";

const OPTIONS = [
  { value: "google", label: "Google TTS" },
  { value: "spitch", label: "Spitch" },
  { value: "elevenlabs", label: "ElevenLabs" },
];

function SelectForm({ onSubmit, initial = "" }: { onSubmit: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <StyledSelect
        label="Provider"
        required
        placeholder="Choose a provider"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        options={OPTIONS}
      />
      <button type="submit">Save</button>
    </form>
  );
}

function ComboForm({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <Combobox label="Voice" required value={value} onValueChange={setValue} options={OPTIONS} />
      <button type="submit">Save</button>
    </form>
  );
}

describe("StyledSelect", () => {
  it("links its label to the trigger and shows the placeholder when empty", () => {
    render(<SelectForm onSubmit={jest.fn()} />);
    const trigger = screen.getByLabelText(/Provider/);
    expect(trigger).toHaveAttribute("role", "combobox");
    expect(trigger).toHaveTextContent("Choose a provider");
    expect(trigger).toHaveAttribute("aria-required", "true");
  });

  it("blocks an empty required submit, marks the trigger invalid and focuses it", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<SelectForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
    const trigger = screen.getByLabelText(/Provider/);
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Please select an option.");
    expect(trigger).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(trigger).toHaveFocus();
  });

  it("clears the error once an option is chosen with the keyboard, then submits", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<SelectForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    const trigger = screen.getByLabelText(/Provider/);
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(trigger).toHaveTextContent(/Spitch|Google TTS/));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-invalid", "false");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.stringMatching(/^(google|spitch)$/));
  });

  it("keeps an existing value submittable without showing an error", async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<SelectForm onSubmit={onSubmit} initial="elevenlabs" />);
    expect(screen.getByLabelText(/Provider/)).toHaveTextContent("ElevenLabs");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith("elevenlabs");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats value '' as a real option when one exists", () => {
    render(
      <StyledSelect
        label="Status"
        value=""
        onChange={jest.fn()}
        options={[{ value: "", label: "All statuses" }, ...OPTIONS]}
      />,
    );
    expect(screen.getByLabelText("Status")).toHaveTextContent("All statuses");
  });
});

describe("Combobox", () => {
  it("filters, moves with the arrow keys and selects with Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ComboForm onSubmit={onSubmit} />);

    const trigger = screen.getByLabelText(/Voice/);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const search = screen.getByRole("textbox", { name: "Search..." });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, "e");
    // "e" matches "Google TTS" and "ElevenLabs", not "Spitch".
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Google TTS", "ElevenLabs"]);
    expect(search).toHaveAttribute("aria-activedescendant", options[0].id);

    await user.keyboard("{ArrowDown}");
    expect(search).toHaveAttribute("aria-activedescendant", options[1].id);
    await user.keyboard("{Enter}");

    expect(trigger).toHaveTextContent("ElevenLabs");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith("elevenlabs");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<ComboForm onSubmit={jest.fn()} />);
    const trigger = screen.getByLabelText(/Voice/);
    await user.click(trigger);
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("blocks an empty required submit with an announced error", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ComboForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please select an option.");
    expect(screen.getByLabelText(/Voice/)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Modal", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open dialog</button>
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Add voice">
          <input aria-label="First field" />
          <button>Last button</button>
        </Modal>
      </>
    );
  }

  it("is a labelled modal dialog that traps Tab and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open dialog" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Add voice" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    // Tab cycles within the dialog.
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("Escape closes an open select inside the dialog without closing the dialog", async () => {
    function WithSelect() {
      const [open, setOpen] = useState(true);
      const [value, setValue] = useState("");
      return (
        <Modal isOpen={open} onClose={() => setOpen(false)} title="Add voice">
          <StyledSelect label="Provider" value={value} onChange={(e) => setValue(e.target.value)} options={OPTIONS} />
        </Modal>
      );
    }
    const user = userEvent.setup();
    render(<WithSelect />);
    await user.click(screen.getByLabelText("Provider"));
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Add voice" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("DialogPanel", () => {
  it("announces a labelled modal dialog, takes focus and closes on Escape", async () => {
    const { DialogPanel } = await import("@/components/ui/modal/DialogPanel");
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <DialogPanel aria-labelledby="t" onClose={() => setOpen(false)}>
              <h2 id="t">Edit letter</h2>
              <input aria-label="Letter" />
            </DialogPanel>
          )}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Edit letter" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Letter")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
