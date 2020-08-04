import {
    Exp, Program, isProgram, isBoolExp, isNumExp, isVarRef, isPrimOp,
    isDefineExp, isProcExp, isIfExp, isAppExp, ProcExp, AppExp,
    PrimOp, IfExp, isCompoundExp, isAtomicExp, AtomicExp, CExp
} from '../imp/L2-ast';
import { Result, bind, mapResult, makeOk, safe3, safe2, makeFailure } from '../imp/result';
import { map } from 'ramda';

/*
Purpose: transform a L2 program to a JavaScript program in a Result
Signature: l2ToJS(exp: Exp | Program): Result<string>
Type: [Exp | Program -> Result<string>]
*/
export const l2ToJS = (exp: Exp | Program): Result<string> =>
    isProgram(exp) ? l2ToJSProgram(exp) :
        isAtomicExp(exp) ? l2ToJSAtomic(exp) :
            isDefineExp(exp) ? bind(l2ToJS(exp.val), (val: string) => makeOk(`const ${exp.var.var} = ${val}`)) :
                isProcExp(exp) ? l2ToJSProcExp(exp) :
                    isIfExp(exp) ? safe3((test: string, then: string, alt: string) => makeOk(`(${test} ? ${then} : ${alt})`))
                        (l2ToJS(exp.test), l2ToJS(exp.then), l2ToJS(exp.alt)) :
                        isAppExp(exp) ? l2ToJSAppExp(exp) :
                            makeFailure(`Unknown expression: ${exp}`);

export const l2ToJSProgram = (exp: Program): Result<string> =>
    exp.exps.length === 1 ? bind(l2ToJS(exp.exps[0]), (program: string) => makeOk(`console.log(${program});`)) :
        bind(mapResult(l2ToJS, exp.exps), (exps: string[]) =>
            makeOk(`${exps.slice(0, exps.length - 1).join(";\n")};\nconsole.log(${exps[exps.length - 1]});`))

export const l2ToJSPrimOp = (exp: PrimOp): Result<string> =>
    exp.op === '=' ? makeOk('===') :
        exp.op === 'not' ? makeOk('!') :
            exp.op === 'and' ? makeOk('&&') :
                exp.op === 'or' ? makeOk('||') :
                    exp.op === 'eq?' ? makeOk('===') :
                        exp.op === 'number?' || exp.op === 'boolean?' ? makeFailure(`Operation cannot translate to a JavaScript expression: ${exp.op}`) :
                            makeOk(exp.op);

export const l2ToJSProcExp = (exp: ProcExp): Result<string> =>
    exp.body.length === 1 ? bind(mapResult(l2ToJS, exp.body), (body: string[]) =>
        makeOk(`((${map(v => v.var, exp.args).join(",")}) => ${body[0]})`)) :
        bind(mapResult(l2ToJS, exp.body), (body: string[]) =>
            makeOk(`((${map(v => v.var, exp.args).join(",")}) => ` +
                `{${body.slice(0, body.length - 1).join("; ")}; return ${body[body.length - 1]};})`));

export const l2ToJSAppExp = (exp: AppExp): Result<string> =>
    isPrimOp(exp.rator) ? l2ToJSPrimeOpAppExp(exp.rator, exp.rands) :
        isProcExp(exp.rator) ? safe2((f: string, args: string[]) => makeOk(`${f}(${args.join(',')})`))
            (l2ToJS(exp.rator), mapResult(l2ToJS, exp.rands)) :
            isVarRef(exp.rator) ? safe2((rator: string, rands: string[]) => makeOk(`${rator}(${rands.join(',')})`))
                (l2ToJSAtomic(exp.rator), mapResult(l2ToJS, exp.rands)) :
                makeFailure(`Invalid AppExpression: ${JSON.stringify(exp)}`);

export const l2ToJSPrimeOpAppExp = (rator: PrimOp, rands: CExp[]): Result<string> =>
    rator.op === 'number?' && rands.length === 1 ? bind(l2ToJS(rands[0]), (rand: string) => makeOk(`(typeof ${rand} === 'number')`)) :
        rator.op === 'boolean?' && rands.length === 1 ? bind(l2ToJS(rands[0]), (rand: string) => makeOk(`(typeof ${rand} === 'boolean')`)) :
            rator.op === 'not' && rands.length === 1 ? bind(l2ToJS(rands[0]), (rand: string) => makeOk(`(!${rand})`)) :
                ['=', 'or', 'and', '/', '-', '<', '>'].includes(rator.op) ? rands.length === 2 ?
                    safe2((rator: string, rands: string[]) => makeOk(`(${rands[0]} ${rator} ${rands[1]})`))
                        (l2ToJSPrimOp(rator), mapResult(l2ToJS, rands)) :
                    makeFailure("Invalid amount of operands") :
                    safe2((rator: string, rands: string[]) => makeOk(`(${rands.join(` ${rator} `)})`))
                        (l2ToJSPrimOp(rator), mapResult(l2ToJS, rands))


export const l2ToJSAtomic = (exp: AtomicExp): Result<string> =>
    isBoolExp(exp) ? makeOk(exp.val ? "true" : "false") :
        isNumExp(exp) ? makeOk(exp.val.toString()) :
            isVarRef(exp) ? makeOk(exp.var) :
                isPrimOp(exp) ? l2ToJSPrimOp(exp) :
                    makeOk(exp);