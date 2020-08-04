import {
    ForExp, AppExp, CExp, Exp, Program, makeAppExp, makeProcExp, makeNumExp, isForExp, isDefineExp, makeDefineExp, makeProgram, isProcExp, isIfExp, isProgram,
    isCExp, isExp, isAppExp, makeIfExp
} from "./L21-ast";
import { Result, makeOk, bind, mapResult, safe2, safe3, makeFailure } from "../imp/result";
import { reduce, range, map } from "ramda";
import { isAtomicExp } from "../imp/L2-ast";

/*
Purpose: transform a ForExp to an AppExp
Signature: for2app(exp:ForExp) : AppExp
Type: [ForExp -> AppExp]
*/
export const for2app = (exp: ForExp): AppExp => {
    const numExps: CExp[] = map(makeNumExp, range(exp.start.val, exp.end.val + 1));
    const appExps: CExp[] = reduce((acc: CExp[], cur: CExp) =>
        acc.concat(makeAppExp(makeProcExp([exp.var], [exp.body]), [cur])), [], numExps);
    return makeAppExp(makeProcExp([], appExps), []);
}

/*
Purpose: transform a L21 AST to L2 AST
Signature: L21ToL2Exp(exp: Exp | Program) : Result<Exp | Program>
Type: [Exp | Program -> Result<Exp | Program>]
*/
export const L21ToL2 = (exp: Exp | Program): Result<Exp | Program> =>
    isProgram(exp) ? bind(mapResult(L21ToL2Exp, exp.exps), (expArr: Exp[]) => makeOk(makeProgram(expArr))) :
        isExp(exp) ? L21ToL2Exp(exp) :
            makeOk(exp)

/*
Purpose: transform a L21 Exp to L2 Exp and returns it in a Result
Signature: L21ToL2Exp(exp: Exp | Program) : Result<Exp | Program>
Type: [Exp | Program -> Result<Exp | Program>]
*/
export const L21ToL2Exp = (exp: Exp): Result<Exp> =>
    isDefineExp(exp) ? bind(L21ToL2Cexp(exp.val), (cexp: CExp) => makeOk(makeDefineExp(exp.var, cexp))) :
        isCExp(exp) ? L21ToL2Cexp(exp) :
            makeOk(exp)

/*
Purpose: transform a L21 CExp to L2 CExp and returns it in a Result
Signature: L21ToL2CExp (exp:CExp) : Result<CExp>
Type: [CExp -> Result<CExp>]
*/
export const L21ToL2Cexp = (exp: CExp): Result<CExp> =>
    isAtomicExp(exp) ? makeOk(exp) :
        isForExp(exp) ? L21ToL2Cexp(for2app(exp)) :
            isProcExp(exp) ? exp.body.length > 0 ? bind(mapResult(L21ToL2Cexp, exp.body), (cexps: CExp[]) => makeOk(makeProcExp(exp.args, cexps))) :
                makeFailure("Invalid lambda expression") :
                isAppExp(exp) ? safe2((rator: CExp, rands: CExp[]) => makeOk(makeAppExp(rator, rands)))
                    (L21ToL2Cexp(exp.rator), mapResult(L21ToL2Cexp, exp.rands)) :
                    isIfExp(exp) ? safe3((test: CExp, then: CExp, alt: CExp) => makeOk(makeIfExp(test, then, alt)))
                        (L21ToL2Cexp(exp.test), L21ToL2Cexp(exp.then), L21ToL2Cexp(exp.alt)) :
                        makeOk(exp)