// This program receives an AST of L4 and transform it to a mermaid AST
import { Result, bind, makeOk, makeFailure, mapResult, safe2, isFailure } from "../shared/result"
import { Graph, makeGraph, GraphContent, makeDir, makeNodeDecl, Node, makeEdge, makeNodeRef, makeCompoundGraph, isCompoundGraph, NodeDecl, CompoundGraph, Edge, isNodeDecl } from "./mermaid-ast"
import { Program, Parsed, isProgram, isExp, Exp, isDefineExp, isPrimOp, isVarRef, isVarDecl, CExp, isAppExp, isIfExp, isAtomicExp, Binding, VarDecl, CompoundExp, isProcExp, AppExp, ProcExp, IfExp, DefineExp, isLetExp, LetExp, isLitExp, isSetExp, LitExp, isLetrecExp, LetrecExp, SetExp, isBoolExp, isCompoundExp, parseL4Program, parseL4Exp } from "./L4-ast"
import { zip, KeyValuePair } from "ramda";
import { parse as p } from "../shared/parser";
import { CompoundSExp, SExpValue, isSymbolSExp, isCompoundSExp } from "./L4-value";
import { isString, isBoolean, isNumber } from "../shared/type-predicates";
import { Sexp } from "s-expression";

export const mapL4toMermaid = (exp: Parsed): Result<Graph> => {
	const typeGen = makeTypeGen();
	return isProgram(exp) ? bind(mapL4ProgramToMermaid(exp, typeGen),
		(content: GraphContent) => makeOk(makeGraph(makeDir("TD"), content))) :
		isExp(exp) ? bind(mapL4ExpToMermaid(exp, makeNodeDecl(typeGen(exp.tag), getLabel(exp)), typeGen),
			(content: GraphContent) => makeOk(makeGraph(makeDir("TD"), content))) :
			makeFailure("Never");
}

const mapL4ProgramToMermaid = (program: Program, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeDecl = makeNodeDecl(typeGen(program.tag), getLabel(program));
	const childNodeDecl = makeNodeDecl(typeGen("Exps"), getLabel("Exps"));
	const childEdge = makeEdge(selfNodeDecl, childNodeDecl, "exps");
	return bind(mapL4ExpArrayToMermaid(program.exps, makeNodeRef(childNodeDecl.id), typeGen),
		(content: GraphContent) => isCompoundGraph(content) ? makeOk(makeCompoundGraph([childEdge].concat(content.edges))) :
			makeFailure("Never"));
}

const mapL4ExpArrayToMermaid = (exps: Exp[], self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const childrenNodeDecls = exps.map((exp: Exp) => makeNodeDecl(typeGen(exp.tag), getLabel(exp)));
	const childrenDeclSExps = zip(exps, childrenNodeDecls);
	const childrenEdges = childrenNodeDecls.map((node: Node) => makeEdge(self, node));
	return bind(mapResult((expNodePair: KeyValuePair<Exp, NodeDecl>) =>
		mapL4ExpToMermaid(expNodePair[0], makeNodeRef(expNodePair[1].id), typeGen), childrenDeclSExps),
		(contents: GraphContent[]) => makeOk(stitchContents(childrenEdges, contents)));

}

const mapL4VarDeclArrayToMermaid = (vars: VarDecl[], self: Node, typeGen: (t: string) => string) => {
	const childrenNodeDecls = vars.map((v: VarDecl) => makeNodeDecl(typeGen(v.tag), getLabel(v)));
	const childrenEdges = childrenNodeDecls.map((node: Node) => makeEdge(self, node));
	return makeOk(makeCompoundGraph(childrenEdges));
}

const mapL4BindingArrayToMermaid = (bindings: Binding[], self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const childrenNodeDecls = bindings.map((binding: Binding) => makeNodeDecl(typeGen(binding.tag), getLabel(binding)));
	const childrenDeclSExps = zip(bindings, childrenNodeDecls);
	const childrenEdges = childrenNodeDecls.map((node: Node) => makeEdge(self, node));
	return bind(mapResult((bindingNodePair: KeyValuePair<Binding, Node>) =>
		mapL4DefineOrBindingExpToMermaid(bindingNodePair[0], makeNodeRef(bindingNodePair[1].id), typeGen), childrenDeclSExps),
		(bindingContents: GraphContent[]) => makeOk(stitchContents(childrenEdges, bindingContents)));
}

const mapL4ExpToMermaid = (exp: Exp, self: Node, typeGen: (t: string) => string): Result<GraphContent> =>
	isDefineExp(exp) ? mapL4DefineOrBindingExpToMermaid(exp, self, typeGen) :
		mapL4CExpToMermaid(exp, self, typeGen)


const mapL4DefineOrBindingExpToMermaid = (exp: DefineExp | Binding, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen(exp.var.tag), getLabel(exp.var)),
		makeNodeDecl(typeGen(exp.val.tag), getLabel(exp.val))
	];
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "var"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "val")
	];
	return bind(mapL4CExpToMermaid(exp.val, makeNodeRef(childrenNodeDecls[1].id), typeGen),
		(content: GraphContent) => isCompoundGraph(content) ? makeOk(makeCompoundGraph(childrenEdges.concat(content.edges))) :
			makeOk(makeCompoundGraph(childrenEdges)));
}

const mapL4CExpToMermaid = (exp: CExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> =>
	isCompoundExp(exp) ? mapL4CompoundExpToMermaid(exp, self, typeGen) :
		isAtomicExp(exp) ? makeOk(makeNodeDecl(self.id, getLabel(exp))) :
			makeFailure("never");

const mapL4CompoundExpToMermaid = (exp: CompoundExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> =>
	isAppExp(exp) ? mapL4AppExpToMermaid(exp, self, typeGen) :
		isProcExp(exp) ? mapL4ProcExpToMermaid(exp, self, typeGen) :
			isIfExp(exp) ? mapL4IfExpToMermaid(exp, self, typeGen) :
				isLetExp(exp) || isLetrecExp(exp) ? mapL4LetOrLetrecExpToMermaid(exp, self, typeGen) :
					isLitExp(exp) ? mapL4LitExpToMermaid(exp, self, typeGen) :
						isSetExp(exp) ? mapL4SetExpToMermaid(exp, self, typeGen) :
							makeFailure("Never");

const mapL4AppExpToMermaid = (exp: AppExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen(exp.rator.tag), getLabel(exp.rator)),
		makeNodeDecl(typeGen("Rands"), getLabel("Rands"))
	];
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "rator"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "rands")
	];
	return safe2((ratorContent: GraphContent, randsContent: GraphContent) =>
		makeOk(stitchContents(childrenEdges, [ratorContent, randsContent])))
		(mapL4CExpToMermaid(exp.rator, makeNodeRef(childrenNodeDecls[0].id), typeGen),
			mapL4ExpArrayToMermaid(exp.rands, makeNodeRef(childrenNodeDecls[1].id), typeGen));
}

const mapL4IfExpToMermaid = (exp: IfExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen(exp.test.tag), getLabel(exp.test)),
		makeNodeDecl(typeGen(exp.then.tag), getLabel(exp.then)),
		makeNodeDecl(typeGen(exp.alt.tag), getLabel(exp.alt))
	];
	const childrenExps = [exp.test, exp.then, exp.alt]
	const childrenDeclSExps = zip(childrenExps, childrenNodeDecls);
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "test"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "then"),
		makeEdge(selfNodeRef, childrenNodeDecls[2], "else")
	];
	return bind(mapResult((pair: KeyValuePair<CExp, NodeDecl>) =>
		mapL4CExpToMermaid(pair[0], makeNodeRef(pair[1].id), typeGen), childrenDeclSExps),
		(childrenContent: GraphContent[]) => makeOk(stitchContents(childrenEdges, childrenContent)))
}

const mapL4ProcExpToMermaid = (exp: ProcExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen("Params"), getLabel("Params")),
		makeNodeDecl(typeGen("Body"), getLabel("Body"))
	];
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "args"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "body")
	];
	return safe2((argContent: GraphContent, bodyContent: GraphContent) =>
		makeOk(stitchContents(childrenEdges, [argContent, bodyContent])))
		(mapL4VarDeclArrayToMermaid(exp.args, makeNodeRef(childrenNodeDecls[0].id), typeGen),
			mapL4ExpArrayToMermaid(exp.body, makeNodeRef(childrenNodeDecls[1].id), typeGen));
}

const mapL4LetOrLetrecExpToMermaid = (exp: LetExp | LetrecExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen("Bindings"), getLabel("Bindings")),
		makeNodeDecl(typeGen("Body"), getLabel("Body"))
	];
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "bindings"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "body")
	];
	return safe2((bindingsContent: GraphContent, bodyContent: GraphContent) =>
		makeOk(stitchContents(childrenEdges, [bodyContent])))
		(mapL4BindingArrayToMermaid(exp.bindings, makeNodeRef(childrenNodeDecls[0].id), typeGen),
			mapL4ExpArrayToMermaid(exp.body, makeNodeRef(childrenNodeDecls[0].id), typeGen));
}

const mapL4LitExpToMermaid = (exp: LitExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const childrenNodeDecl = makeNodeDecl(typeGen(getSExpValName(exp.val)), getLabel(exp.val));
	const childrenEdges = [
		makeEdge(self, childrenNodeDecl, "val")
	];
	return bind(mapL4SExpValueToMermaid(exp.val, makeNodeRef(childrenNodeDecl.id), typeGen), (valContent: GraphContent) =>
		isCompoundGraph(valContent) ? makeOk(stitchContents(childrenEdges, [valContent])) :
			makeOk(makeCompoundGraph(childrenEdges)))
}

const mapL4SExpValueToMermaid = (val: SExpValue, self: Node, typeGen: (t: string) => string): Result<GraphContent> =>
	isCompoundSExp(val) ? mapL4CompoundSExpToMermaid(val, self, typeGen) :
		makeOk(makeNodeDecl(self.id, getLabel(val)))

const mapL4CompoundSExpToMermaid = (compoundSExp: CompoundSExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen(getSExpValName(compoundSExp.val1)), getLabel(compoundSExp.val1)),
		makeNodeDecl(typeGen(getSExpValName(compoundSExp.val2)), getLabel(compoundSExp.val2))
	];
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "val1"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "val2")
	];

	return safe2((val1: GraphContent, val2: GraphContent) => makeOk(stitchContents(childrenEdges, [val1, val2])))
		(mapL4SExpValueToMermaid(compoundSExp.val1, makeNodeRef(childrenNodeDecls[0].id), typeGen),
			mapL4SExpValueToMermaid(compoundSExp.val2, makeNodeRef(childrenNodeDecls[1].id), typeGen))
}

const mapL4SetExpToMermaid = (exp: SetExp, self: Node, typeGen: (t: string) => string): Result<GraphContent> => {
	const selfNodeRef = makeNodeRef(self.id);
	const childrenNodeDecls = [
		makeNodeDecl(typeGen(exp.var.tag), getLabel(exp.var)),
		makeNodeDecl(typeGen(exp.val.tag), getLabel(exp.val))
	];
	const childrenEdges = [
		makeEdge(self, childrenNodeDecls[0], "var"),
		makeEdge(selfNodeRef, childrenNodeDecls[1], "val")
	];
	return bind(mapL4CExpToMermaid(exp.val, makeNodeRef(childrenNodeDecls[1].id), typeGen),
		(valContent: GraphContent) =>
			isCompoundGraph(valContent) ? makeOk(stitchContents(childrenEdges, [valContent]))
				: makeOk(makeCompoundGraph(childrenEdges)));
}

const stitchContents = (edges: Edge[], contents: GraphContent[]): CompoundGraph => {
	const subTrees = zip(edges, contents);
	return makeCompoundGraph(subTrees.reduce((acc: Edge[], curr: KeyValuePair<Edge, GraphContent>) =>
		isCompoundGraph(curr[1]) ? acc.concat([curr[0]]).concat(curr[1].edges) : acc.concat([curr[0]]), []));
}

const getLabel = (exp: Parsed | SExpValue | VarDecl | Binding | "Body" | "Rands" | "Exps" | "Params" | "Bindings"): string =>
	exp === "Body" || exp === "Rands" || exp === "Exps" || exp === "Params" || exp === "Bindings" ? ":" :
		isVarDecl(exp) ? `"${exp.tag}(${exp.var})"` :
			isNumber(exp) ? `"number(${exp})"` :
				isBoolean(exp) ? `"boolean(${exp})"` :
					isString(exp) ? `"string(${exp})"` :
						isSymbolSExp(exp) ? `"SymbolSExp(${exp.val})"` :
							isAtomicExp(exp) ? isPrimOp(exp) ? `"${exp.tag}(${exp.op})"` :
								isBoolExp(exp) ? exp.val ? `"${exp.tag}(#t)"` : `"${exp.tag}(#f)"` :
									isVarRef(exp) ? `"${exp.tag}(${exp.var})"` :
										`"${exp.tag}(${exp.val})"` :
								exp.tag;

const getSExpValName = (SExpVal: SExpValue): string =>
	isNumber(SExpVal) ? "number" :
		isBoolean(SExpVal) ? "boolean" :
			isString(SExpVal) ? "string" :
				SExpVal.tag

export const makeTypeGen = (): (t: string) => string => {
	let countDic: { [key: string]: number } = { //We create a dictionary to save a counter for each type
		"Program": 0, "DefineExp": 0, "NumExp": 0, "BoolExp": 0, "StrExp": 0, "PrimOp": 0,
		"VarRef": 0, "VarDecl": 0, "AppExp": 0, "IfExp": 0, "ProcExp": 0, "Binding": 0,
		"LetExp": 0, "LitExp": 0, "number": 0, "boolean": 0, "string": 0, "Closure": 0,
		"SymbolSExp": 0, "EmptySExp": 0, "CompoundSExp": 0, "LetRecExp": 0, "SetExp": 0,
		"Exps": 0, "Params": 0, "Rands": 0, "Body": 0, "Bindings": 0
	}
	return (t: string) => {
		countDic[t]++;
		return `${t}_${countDic[t]}`;
	};
};


/*
 * Q2.3 
 */

export const unparseMermaid = (graph: Graph): Result<string> =>
	bind(unparseGraphContent(graph.content), (content: string) => makeOk(`graph ${graph.dir.dir}\n${content}`))

const unparseGraphContent = (graphContent: GraphContent): Result<string> =>
	isCompoundGraph(graphContent) ? unparseCompoundGraph(graphContent) :
		unparseNode(graphContent)

const unparseCompoundGraph = (compoundGraph: CompoundGraph): Result<string> =>
	bind(mapResult((edge: Edge) => unparseEdge(edge), compoundGraph.edges), (edgesString: string[]) => makeOk(edgesString.join(`\n`)))

const unparseEdge = (exp: Edge): Result<string> => {
	return isString(exp.label) ?
		safe2((from: string, to: string) => makeOk(`${from} -->|${exp.label}| ${to}`))
			(unparseNode(exp.from), unparseNode(exp.to)) :
		safe2((from: string, to: string) => makeOk(`${from} -->${to}`))
			(unparseNode(exp.from), unparseNode(exp.to))
}

const unparseNode = (node: Node): Result<string> =>
	isNodeDecl(node) ? makeOk(`${node.id}[${node.label}]`) :
		makeOk(`${node.id}`)

export const L4toMermaid = (concrete: string): Result<string> =>
	bind(parseL4ProgramOrExp(concrete), (parsed: Parsed) =>
		bind(mapL4toMermaid(parsed), (graph: Graph) => unparseMermaid(graph)))

const parseL4ProgramOrExp = (concrete: string): Result<Parsed> => {
	const parsed = p(concrete);
	const parsedProgram = bind(parsed, (sexp: Sexp) => parseL4Program(sexp));
	return isFailure(parsedProgram) ? bind(parsed, (sexp: Sexp) => parseL4Exp(sexp)) : parsedProgram;
}