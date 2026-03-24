import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from '../src';

interface TestEvents {
    click: { x: number; y: number };
    message: string;
}

describe('EventEmitter', () => {
    it('emits events to handlers', () => {
        const emitter = new EventEmitter<TestEvents>();
        const handler = vi.fn();

        emitter.on('message', handler);
        emitter.emit('message', 'hello');

        expect(handler).toHaveBeenCalledWith('hello');
    });

    it('supports multiple handlers', () => {
        const emitter = new EventEmitter<TestEvents>();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        emitter.on('click', handler1);
        emitter.on('click', handler2);
        emitter.emit('click', { x: 1, y: 2 });

        expect(handler1).toHaveBeenCalledWith({ x: 1, y: 2 });
        expect(handler2).toHaveBeenCalledWith({ x: 1, y: 2 });
    });

    it('returns unsubscribe function from on()', () => {
        const emitter = new EventEmitter<TestEvents>();
        const handler = vi.fn();

        const unsub = emitter.on('message', handler);
        unsub();
        emitter.emit('message', 'hello');

        expect(handler).not.toHaveBeenCalled();
    });

    it('removes handler with off()', () => {
        const emitter = new EventEmitter<TestEvents>();
        const handler = vi.fn();

        emitter.on('message', handler);
        emitter.off('message', handler);
        emitter.emit('message', 'hello');

        expect(handler).not.toHaveBeenCalled();
    });

    it('removes all listeners for an event', () => {
        const emitter = new EventEmitter<TestEvents>();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        emitter.on('message', handler1);
        emitter.on('message', handler2);
        emitter.removeAllListeners('message');
        emitter.emit('message', 'hello');

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
    });

    it('removes all listeners when no event specified', () => {
        const emitter = new EventEmitter<TestEvents>();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        emitter.on('message', handler1);
        emitter.on('click', handler2);
        emitter.removeAllListeners();
        emitter.emit('message', 'hello');
        emitter.emit('click', { x: 0, y: 0 });

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
    });

    it('counts listeners', () => {
        const emitter = new EventEmitter<TestEvents>();
        expect(emitter.listenerCount('message')).toBe(0);

        emitter.on('message', () => {});
        emitter.on('message', () => {});
        expect(emitter.listenerCount('message')).toBe(2);
    });

    it('does not throw when emitting without listeners', () => {
        const emitter = new EventEmitter<TestEvents>();
        expect(() => emitter.emit('message', 'hello')).not.toThrow();
    });

    it('does not throw when removing non-existent handler', () => {
        const emitter = new EventEmitter<TestEvents>();
        expect(() => emitter.off('message', () => {})).not.toThrow();
    });
});
