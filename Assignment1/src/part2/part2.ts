import { reduce, filter, map, compose, T } from 'ramda'
import { expect } from "chai";

/* Question 1 */
export const partition : <T>(pred: (param: T) => boolean, arr: T[]) =>T[][]  =
	<T>(pred: (param: T) => boolean, arr: T[]): T[][] =>
		[filter(pred, arr), filter(item => !pred(item), arr)];


/* Question 2 */
export const mapMat : <T,U> (func: (param: T) => U, matrix: T[][]) => U[][] =
	<T,U>(func: (param: T) => U, matrix: T[][]): U[][] =>
		matrix.reduce(
			(acc: U[][], cur: T[]) =>
				acc.concat([map(func, cur)]),[]);

/* Question 3 */
export const composeMany : <T>(functions: ((param: T) => T)[])=>(param: T) => T =
	<T>(functions: ((param: T) => T)[]): (param: T) => T =>
		functions.reduceRight(
			(comp: (x: T) => T, func: (x: T) => T) =>
				(x => func(comp(x))),
			x => x
		);
		

/* Question 4 */
interface Languages {
	english: string;
	japanese: string;
	chinese: string;
	french: string;
}

interface Stats {
	HP: number;
	Attack: number;
	Defense: number;
	"Sp. Attack": number;
	"Sp. Defense": number;
	Speed: number;
}

interface Pokemon {
	id: number;
	name: Languages;
	type: string[];
	base: Stats;
}

export const maxSpeed: (pokedex: Pokemon[]) => Pokemon[] =
	(pokedex: Pokemon[]): Pokemon[] => pokedex.filter(
		(pokemon: Pokemon) => pokemon.base.Speed === pokedex.reduce(
			(max: number, pokemon: Pokemon) =>
				max >= pokemon.base.Speed ? max : pokemon.base.Speed,
			0));

export const grassTypes : (pokedex: Pokemon[]) => string[] =
	(pokedex: Pokemon[]): string[] =>
		pokedex.filter(
			(pokemon: Pokemon) =>
				pokemon.type.includes("Grass")).map(
					(pokemon: Pokemon) =>
						pokemon.name.english
				).sort();

export const uniqueTypes : (pokedex: Pokemon[]) => string[] =
	(pokedex: Pokemon[]): string[] => pokedex.reduce(
		(acc: string[], pokemon: Pokemon) =>
			acc.concat(pokemon.type),
		[]).reduce(
			(acc: string[], type: string) =>
				acc.includes(type) ? acc : acc.concat(type),
			[]).sort();
