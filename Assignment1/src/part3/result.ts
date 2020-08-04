/* Question 3 */

export type Result<T> = Ok<T> | Failure;

export interface Failure {
	tag: 'Failure',
	message: string
}

export interface Ok<T> {
	tag: 'Ok'
	value: T
}


export const makeOk =
	<T>(value: T): Ok<T> =>
		({ tag: 'Ok', value: value });

export const makeFailure =
	(message: string): Failure =>
		({ tag: 'Failure', message: message });


export const isOk =
	<T>(x: Result<T>): x is Ok<T> =>
		x.tag == 'Ok' && x.value !== undefined;

export const isFailure =
	<T>(x: Result<T>): x is Failure =>
		x.tag === 'Failure' && x.message !== undefined;

/* Question 4 */
export const bind =
	<T, U>(result: Result<T>, func: (x: T) => Result<U>): Result<U> =>
		isOk(result) ? func(result.value) : makeFailure(result.message);


/* Question 5 */
export interface User {
	name: string;
	email: string;
	handle: string;
}


const validateName = (user: User): Result<User> =>
	user.name.length === 0 ? makeFailure("Name cannot be empty") :
		user.name === "Bananas" ? makeFailure("Bananas is not a name") :
			makeOk(user);

const validateEmail = (user: User): Result<User> =>
	user.email.length === 0 ? makeFailure("Email cannot be empty") :
		user.email.endsWith("bananas.com") ? makeFailure("Domain bananas.com is not allowed") :
			makeOk(user);

const validateHandle = (user: User): Result<User> =>
	user.handle.length === 0 ? makeFailure("Handle cannot be empty") :
		user.handle.startsWith("@") ? makeFailure("This isn't Twitter") :
			makeOk(user);

export const naiveValidateUser =
	(user: User): Result<User> =>
		isOk(validateName(user)) ?
			isOk(validateEmail(user)) ?
				validateHandle(user) : validateEmail(user) : validateName(user);

export const monadicValidateUser =
	(user: User): Result<User> =>
		bind(validateName(user), (user: User): Result<User> =>
			bind(validateEmail(user), validateHandle));