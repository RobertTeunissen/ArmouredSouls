import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RobotNamingModal from '../RobotNamingModal';

function renderModal(props: Partial<Parameters<typeof RobotNamingModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <RobotNamingModal robotCount={2} onConfirm={onConfirm} onCancel={onCancel} isSubmitting={false} error={null} {...props} />,
  );
  return { onConfirm, onCancel };
}

const create = (): HTMLElement => screen.getByRole('button', { name: /Create Robot/ });

describe('RobotNamingModal', () => {
  it('asks for one name per robot and focuses the first field', () => {
    renderModal({ robotCount: 3 });
    expect(screen.getByRole('dialog', { name: 'Name your robots' })).toBeInTheDocument();
    expect(screen.getByLabelText('Robot #1 Name')).toHaveFocus();
    expect(screen.getByLabelText('Robot #3 Name')).toBeInTheDocument();
    expect(create()).toHaveTextContent('Create Robots');
  });

  it('uses singular wording for a single robot', () => {
    renderModal({ robotCount: 1 });
    expect(screen.getByRole('heading', { name: 'Name Your Robot' })).toBeInTheDocument();
    expect(create()).toHaveTextContent(/^Create Robot$/);
  });

  it('submits trimmed names once every name is filled in', () => {
    const { onConfirm } = renderModal();
    expect(create()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Robot #1 Name'), { target: { value: '  Iron Fist ' } });
    fireEvent.change(screen.getByLabelText('Robot #2 Name'), { target: { value: '   ' } });
    expect(create()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Robot #2 Name'), { target: { value: 'Steel Jaw' } });
    fireEvent.click(create());
    expect(onConfirm).toHaveBeenCalledWith(['Iron Fist', 'Steel Jaw']);
  });

  it('rejects names that only differ in case or spacing', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByLabelText('Robot #1 Name'), { target: { value: 'Titan' } });
    fireEvent.change(screen.getByLabelText('Robot #2 Name'), { target: { value: ' titan ' } });
    expect(screen.getByText('Each robot must have a unique name.')).toBeInTheDocument();
    expect(create()).toBeDisabled();
    fireEvent.submit(create().closest('form')!);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('goes back on Escape or Back, but not while the robots are being created', () => {
    const first = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(first.onCancel).toHaveBeenCalledTimes(2);
  });

  it('locks the form and shows the server error while submitting', () => {
    const { onCancel } = renderModal({ isSubmitting: true, error: 'Name already taken' });
    expect(screen.getByText('Name already taken')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByLabelText('Robot #1 Name')).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
