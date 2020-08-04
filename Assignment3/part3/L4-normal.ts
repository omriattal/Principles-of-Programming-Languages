// ========================================================
// L4 normal eval
import { Sexp } from "s-expression";
//import { map } from "ramda";
import {
    Exp, Program, parseL4Exp, isBoolExp, isNumExp, isStrExp, isPrimOp, isLitExp,
    isVarRef, isAtomicExp, isIfExp, isProcExp,
    isAppExp, AppExp, CExp, isDefineExp, isCExp, IfExp, isLetExp, VarRef, ProcExp, PrimOp, VarDecl, Binding, LetExp
} from "./L4-ast";
import { makeEmptyEnv, Env, applyEnv, makeExtEnv, makeRecEnv } from './L4-env-normal';
import { Value, makeClosure, isClosure, makePromise, isPromise, Closure } from "./L4-value";
import { Result, makeFailure, bind, makeOk, mapResult } from "../shared/result";
import { parse as p } from "../shared/parser";
import { isEmpty, rest, first } from "../shared/list";
import { applyPrimitive } from "./evalPrimitive";
import { map, contains, KeyValuePair, reduce } from "ramda";

/*
Purpose: Evaluate an L3 expression with normal-eval algorithm
Signature: L3-normal-eval(exp,env)
Type: CExp * Env => Value
*/
const normalEval = (exp: CExp, env: Env): Result<Value> =>
    isBoolExp(exp) ? makeOk(exp.val) :
        isNumExp(exp) ? makeOk(exp.val) :
            isStrExp(exp) ? makeOk(exp.val) :
                isPrimOp(exp) ? makeOk(exp) :
                    isLitExp(exp) ? makeOk(exp.val) :
                        isVarRef(exp) ? evalVarRef(exp, env) :
                            isIfExp(exp) ? evalIf(exp, env) :
                                isProcExp(exp) ? evalProc(exp, env) :
                                    isLetExp(exp) ? evalLet(exp, env) :
                                        isAppExp(exp) ? bind(normalEval(exp.rator, env),
                                            proc => isPromise(proc) ? bind(normalEval(proc.val, proc.env), (procVal: Value) =>
                                                normalApplyProc(procVal, exp.rands, env)) :
                                                normalApplyProc(proc, exp.rands, env)) :
                                            makeFailure(`Bad ast: ${exp}`);

const evalVarRef = (exp: VarRef, env: Env): Result<Value> =>
    bind(applyEnv(env, exp.var), (prom: KeyValuePair<CExp, Env>) =>
        isAtomicExp(prom[0]) || isLitExp(prom[0]) || isProcExp(prom[0]) ? normalEval(prom[0], prom[1]) :
            makeOk(makePromise(prom[0], prom[1])))

const evalIf = (exp: IfExp, env: Env): Result<Value> =>
    bind(normalEval(exp.test, env), (test: Value) =>
        isPromise(test) ? bind(normalEval(test.val, test.env),
            (testVal: Value) => isTrueValue(testVal) ? normalEval(exp.then, env) : normalEval(exp.alt, env)) :
            isTrueValue(test) ? normalEval(exp.then, env) : normalEval(exp.alt, env))

export const isTrueValue = (x: Value): boolean =>
    !(x === false);

const evalProc = (exp: ProcExp, env: Env): Result<Value> => makeOk(makeClosure(exp.args, exp.body, env));

const evalLet = (exp: LetExp, env: Env): Result<Value> => {
    const vars = map((b: Binding) => b.var.var, exp.bindings);
    return evalExps(exp.body, makeExtEnv(vars, map((b: Binding) => [b.val, env], exp.bindings), env));
}

const normalApplyProc = (proc: Value, args: CExp[], env: Env): Result<Value> =>
    isPrimOp(proc) ? bind((mapResult((rand: CExp) => normalEval(rand, env), args)),
        (rands: Value[]) => applyPrimOp(proc, rands, env)) :
        isClosure(proc) ? applyClosure(proc, args, env) :
            makeFailure(`Bad procedure ${JSON.stringify(proc)}`);

const applyPrimOp = (rator: PrimOp, rands: Value[], env: Env): Result<Value> =>
    bind(mapResult((value: Value) => isPromise(value) ? normalEval(value.val, value.env) : makeOk(value), rands),
        (values: Value[]) => containsPromise(values) ? makeFailure("Unexpected Promise in array: " + JSON.stringify(values)) :
            applyPrimitive(rator, values));

const applyClosure = (proc: Closure, args: CExp[], env: Env): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    return bind(evalExps(proc.body, makeExtEnv(vars, map((arg: CExp) => [arg, env], args), proc.env)),
        (value: Value) => isPromise(value) ? normalEval(value.val, value.env) : makeOk(value))
}

const containsPromise = (values: Value[]): Boolean =>
    values.reduce((acc: Boolean, curr: Value) => acc || isPromise(curr), false);

export const evalNormalProgram = (program: Program): Result<Value> =>
    evalExps(program.exps, makeEmptyEnv());

export const evalExps = (exps: Exp[], env: Env): Result<Value> =>
    isEmpty(exps) ? makeFailure("Empty program") :
        isDefineExp(first(exps)) ? evalDefineExps(first(exps), rest(exps), env) :
            evalCExps(first(exps), rest(exps), env);

const evalCExps = (exp1: Exp, exps: Exp[], env: Env): Result<Value> =>
    isCExp(exp1) && isEmpty(exps) ? normalEval(exp1, env) :
        isCExp(exp1) ? bind(normalEval(exp1, env), _ => evalExps(exps, env)) :
            makeFailure("Never");

const evalDefineExps = (def: Exp, exps: Exp[], env: Env): Result<Value> =>
    isDefineExp(def) ? isProcExp(def.val) ? evalExps(exps, makeRecEnv([def.var.var], [def.val.args], [def.val.body], env)) :
        evalExps(exps, makeExtEnv([def.var.var], [[def.val, env]], env)) :
        makeFailure("Unexpected" + def);

export const evalNormalParse = (s: string): Result<Value> =>
    bind(p(s),
        (parsed: Sexp) => bind(parseL4Exp(parsed),
            (exp: Exp) => evalExps([exp], makeEmptyEnv())));