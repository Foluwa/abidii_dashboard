/**
 * Shared confirmation dialog (ui/modal/ConfirmationModal + useConfirm) and
 * the Alerts Hub "Send Critical Alert" test, which used an ad-hoc old-style
 * popup before moving onto the shared dialog.
 */
import React from 'react';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders as render } from '@/test-utils';
import { ConfirmationModal } from '@/components/ui/modal/ConfirmationModal';
import { useConfirm } from '@/hooks/useConfirm';
import { TestingContent } from '@/components/system/TestingContent';

const mockApiPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

function renderModal(props: Partial<React.ComponentProps<typeof ConfirmationModal>> = {}) {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  const utils = render(
    <ConfirmationModal
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Thing"
      message="Are you sure?"
      confirmText="Delete"
      variant="danger"
      {...props}
    />,
  );
  return { onClose, onConfirm, ...utils };
}

describe('ConfirmationModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a labelled modal dialog with the message and focuses inside it', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Delete Thing' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Are you sure?')).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const { onConfirm, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Cancel and on Escape', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('disables both buttons and ignores Escape while pending', () => {
    const { onClose, onConfirm } = renderModal({ isLoading: true });
    const confirmButton = screen.getByRole('button', { name: /Processing/ });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(confirmButton);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useConfirm', () => {
  function Harness({ onResult }: { onResult: (value: boolean) => void }) {
    const { confirm, modal } = useConfirm();
    return (
      <>
        {modal}
        <button
          onClick={async () =>
            onResult(await confirm({ title: 'Remove', message: 'Remove it?', confirmLabel: 'Remove' }))
          }
        >
          open
        </button>
      </>
    );
  }

  it('resolves true on confirm and false on Escape, closing each time', async () => {
    const onResult = jest.fn();
    render(<Harness onResult={onResult} />);

    fireEvent.click(screen.getByText('open'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('open'));
    await screen.findByRole('dialog', { name: 'Remove' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Alerts Hub critical alert test', () => {
  beforeEach(() => mockApiPost.mockReset());

  it('cancel closes the dialog without sending', () => {
    render(<TestingContent showHeader={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Critical Alert' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm Critical Alert Test' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('confirm sends the alert, disables confirm while sending, then shows the result', async () => {
    let resolvePost: (value: unknown) => void = () => {};
    mockApiPost.mockReturnValueOnce(new Promise((resolve) => { resolvePost = resolve; }));
    render(<TestingContent showHeader={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Send Critical Alert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Send Alert' }));

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/admin/test-critical-alert');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Processing/ })).toBeDisabled();

    await act(async () => resolvePost({ data: { sent: true } }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/"sent": true/)).toBeInTheDocument();
  });

  it('shows the error message when sending fails', async () => {
    mockApiPost.mockRejectedValueOnce({ response: { data: { detail: 'Telegram down' } } });
    render(<TestingContent showHeader={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Critical Alert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Send Alert' }));
    expect(await screen.findByText('Telegram down')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
