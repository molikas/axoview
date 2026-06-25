/**
 * useInlineRename — canvas inline-rename click-away contract (shake-out #6,
 * ADR 0022 §4). Left-click-away + Enter PERSIST; right-click-away + Escape
 * CANCEL. These tests pin the commit-vs-cancel routing without depending on
 * jsdom's focus/innerText quirks: handlers are driven with synthetic events,
 * and the capture-phase pointerdown listener is exercised against a real
 * element with a spied `blur`.
 */
import { renderHook, act } from '@testing-library/react';
import { useInlineRename } from '../useInlineRename';

type AnyEvent = Record<string, unknown>;

const keyEvent = (key: string, blur: () => void, shiftKey = false): AnyEvent => ({
  key,
  shiftKey,
  stopPropagation: jest.fn(),
  preventDefault: jest.fn(),
  currentTarget: { blur }
});

describe('useInlineRename — commit/cancel contract', () => {
  it('Enter blurs (which commits) and prevents default', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel })
    );
    const blur = jest.fn();
    const e = keyEvent('Enter', blur);
    act(() => result.current.onKeyDown(e as never));

    expect(e.preventDefault).toHaveBeenCalled();
    expect(blur).toHaveBeenCalled();

    // The resulting blur commits the current text.
    act(() =>
      result.current.onBlur({ currentTarget: { innerText: 'hello' } } as never)
    );
    expect(commit).toHaveBeenCalledWith('hello');
    expect(cancel).not.toHaveBeenCalled();
  });

  it('Escape blurs and the resulting blur CANCELS (no commit)', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel })
    );
    const blur = jest.fn();
    act(() => result.current.onKeyDown(keyEvent('Escape', blur) as never));
    expect(blur).toHaveBeenCalled();

    act(() =>
      result.current.onBlur({ currentTarget: { innerText: 'edited' } } as never)
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it('a plain blur (left-click away elsewhere) commits the current text', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel })
    );
    act(() =>
      result.current.onBlur({ currentTarget: { innerText: 'kept' } } as never)
    );
    expect(commit).toHaveBeenCalledWith('kept');
    expect(cancel).not.toHaveBeenCalled();
  });

  it('multiline: Shift+Enter inserts a newline (does not blur/commit)', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel, multiline: true })
    );
    const blur = jest.fn();
    const e = keyEvent('Enter', blur, true);
    act(() => result.current.onKeyDown(e as never));
    expect(blur).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('pointerdown OUTSIDE with the left button commits', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel })
    );
    const el = document.createElement('div');
    document.body.appendChild(el);
    const blurSpy = jest.spyOn(el, 'blur').mockImplementation(() => {});
    act(() => result.current.setRef(el));

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0 })
      );
    });
    expect(blurSpy).toHaveBeenCalled();

    act(() =>
      result.current.onBlur({ currentTarget: { innerText: 'v' } } as never)
    );
    expect(commit).toHaveBeenCalledWith('v');
    expect(cancel).not.toHaveBeenCalled();

    el.remove();
  });

  it('pointerdown OUTSIDE with the right button cancels', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel })
    );
    const el = document.createElement('div');
    document.body.appendChild(el);
    const blurSpy = jest.spyOn(el, 'blur').mockImplementation(() => {});
    act(() => result.current.setRef(el));

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 2 })
      );
    });
    expect(blurSpy).toHaveBeenCalled();

    act(() =>
      result.current.onBlur({ currentTarget: { innerText: 'v' } } as never)
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();

    el.remove();
  });

  it('pointerdown INSIDE the editor does not blur (cursor repositioning)', () => {
    const commit = jest.fn();
    const cancel = jest.fn();
    const { result } = renderHook(() =>
      useInlineRename({ active: true, commit, cancel })
    );
    const el = document.createElement('div');
    document.body.appendChild(el);
    const blurSpy = jest.spyOn(el, 'blur').mockImplementation(() => {});
    act(() => result.current.setRef(el));

    act(() => {
      el.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, button: 0 })
      );
    });
    expect(blurSpy).not.toHaveBeenCalled();

    el.remove();
  });
});
