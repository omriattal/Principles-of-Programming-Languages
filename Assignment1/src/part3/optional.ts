/* Question 1 */

import { reduce } from "ramda";

export type Optional<T> = Some<T> | None;

export interface Some<T> {
	tag: 'Some',
	value: T,
};

export interface None {
	tag: 'None'
}

export const makeSome =
	<T>(value: T): Some<T> =>
		({ tag: 'Some', value: value });

export const makeNone = 
	(): None =>
		({ tag: 'None' });


export const isSome = <T>(x: Optional<T>): x is Some<T> =>
	x.tag === 'Some' && x.value !== undefined;

export const isNone = <T>(x: Optional<T>): x is None =>
		x.tag === 'None';

/* Question 2 */
export const bind: <T, U>(opt: Optional<T>, func: (x: T) => Optional<U>) => Optional<U> =
	<T, U>(opt: Optional<T>, func: (x: T) => Optional<U>): Optional<U> =>
		isSome(opt) ? func(opt.value) : makeNone();
