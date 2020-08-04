import {bind} from "../shared/result";
import {evalNormalParse, evalNormalProgram} from '../L3/L3-normal';
import {parseL3} from "../L3/L3-ast";

const pretty = (obj: any): void => console.log(JSON.parse(JSON.stringify(obj, undefined, 2)));

const e1 = evalNormalParse("(+)");
const e2 = evalNormalParse("(-)");
const p1 = bind(parseL3(`(L3 (define x (+)) x)`), evalNormalProgram);
const p2 = bind(parseL3(`(L3 (define x (-)) x)`), evalNormalProgram);
const p3 = bind(parseL3(`(L3 (define x (-)) 1)`), evalNormalProgram);

pretty(e1);
pretty(p1);
pretty(e2);
pretty(p2);
pretty(p3);
