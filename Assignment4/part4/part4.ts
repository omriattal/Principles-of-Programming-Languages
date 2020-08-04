function f(x: number): Promise<number> {
	return new Promise((resolve, reject) => {
		try {
			resolve(1 / x);
		}
		catch (err) {
			console.log(err);
			reject(err);
		}
	})
}

function g(x: number): Promise<number> {
	return new Promise((resolve, reject) => {
		try {
			resolve(x * x);
		}
		catch (err) {
			console.log(err);
			reject(err);
		}
	})
}

function h(x: number): Promise<number> {
	return new Promise(async (resolve, reject) => {
		try {
			resolve(await f(await g(x)));
		}
		catch (err) {
			console.log(err);
			reject(err);
		}
	})
}

function slower<T1, T2>(ps: Promise<T1 | T2>[]): Promise<[number, T1 | T2]> {
	return new Promise(async (resolve, reject) => {
		try {
			let arr: [number, T1 | T2][] = [];
			ps[0].then(async _ => resolve([1, await ps[1]]))
				.catch((e) => { throw e })
			ps[1].then(async _ => resolve([0, await ps[0]]))
				.catch((e) => { throw e })
		} catch (e) {
			reject(e);
		}
	})
}