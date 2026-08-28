import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TwoFactorForm from "@/components/auth/TwoFactorForm";

jest.mock("@/components/ui/alert/SimpleAlert", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const challenge = {
  requires_2fa: true as const,
  challenge_id: "f29978d6-78aa-4a37-9a3e-8329c4e75567",
  expires_in: 600,
};

describe("TwoFactorForm", () => {
  it("accepts only six digits and verifies the challenge", async () => {
    const onVerify = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <TwoFactorForm
        email="admin@abidii.app"
        challenge={challenge}
        onVerify={onVerify}
        onResend={jest.fn()}
        onBack={jest.fn()}
      />
    );

    const input = screen.getByLabelText("Verification code");
    await user.type(input, "12x34567");
    expect(input).toHaveValue("123456");
    await user.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith("123456"));
  });

  it("resends through the supplied password-login callback", async () => {
    const onResend = jest.fn().mockResolvedValue(undefined);
    render(
      <TwoFactorForm
        email="admin@abidii.app"
        challenge={challenge}
        onVerify={jest.fn()}
        onResend={onResend}
        onBack={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() => expect(onResend).toHaveBeenCalledTimes(1));
    expect(screen.getByText("A new verification code has been sent.")).toBeInTheDocument();
  });
});
