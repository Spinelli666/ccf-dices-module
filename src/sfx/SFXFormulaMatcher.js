const SUPPORTED_MODIFIERS = ['cs', 'cf', 'kh', 'kl', 'dl', 'dh'];
const OPERATORS = ['==', '>=', '<=', '>', '<'];
const COUNT_KEYWORDS = ['success', 'failure', 'discarded', 'rerolled', 'exploded'];

const parseCache = new Map();

// [count]d<faces>[modifier]
// groups: 1=count, 2=faces, 3=modType, 4=modOp, 5=modValue
const DIE_TERM_RE = /^(\d+|\*)?d(\d+)(?:(cs|cf|kh|kl|dl|dh)(>=|<=|>|<|=)?(\d+)?)?$/;

// [!]keyword(diceExpr) — groups: 1=negation, 2=keyword, 3=inner dice expression
const COUNT_RE = /^(!?)(success|failure|discarded|rerolled|exploded)\((.+)\)$/;

export class SFXFormulaMatcher {

	static parse(formula) {
		if (typeof formula !== 'string' || !formula.trim()) return null;

		const normalized = SFXFormulaMatcher._normalizeWhitespace(formula);
		const cached = parseCache.get(normalized);
		if (cached !== undefined) return cached;

		const result = SFXFormulaMatcher._doParse(normalized);
		if (result) parseCache.set(normalized, result);
		return result;
	}

	//make whitespace around formula-level comparisons optional.
	static _normalizeWhitespace(formula) {
		return formula
			.replace(/==/g, ' == ')
			.replace(/(?<!cs|cf|kh|kl|dl|dh)(>=|<=|>|<)/g, ' $1 ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	static _doParse(formula) {
		if (formula.startsWith('count(')) {
			return SFXFormulaMatcher._parseCountPredicate(formula);
		}

		const tokens = formula.split(/\s+/);

		if (tokens[0] === 'total') {
			if (tokens.length !== 3) return null;
			if (!OPERATORS.includes(tokens[1])) return null;
			const values = SFXFormulaMatcher._parseValues(tokens[2]);
			if (!values) return null;
			if (tokens[1] !== '==' && values.length > 1) return null;
			return { type: 'total', operator: tokens[1], values };
		}

		const countMatch = COUNT_RE.exec(tokens[0]);
		if (countMatch) {
			const negated = countMatch[1] === '!';
			const keyword = countMatch[2];
			const innerMatch = DIE_TERM_RE.exec(countMatch[3]);
			if (!innerMatch) return null;

			const faces = parseInt(innerMatch[2]);
			let modifier = null;
			if (innerMatch[3]) {
				modifier = { type: innerMatch[3], params: null };
				if (innerMatch[4]) {
					if (!innerMatch[5]) return null;
					modifier.params = innerMatch[4] + innerMatch[5];
				}
			}

			if (tokens.length === 1) {
				return { type: 'count', keyword, negated, faces, modifier, operator: null, values: null };
			}

			if (tokens.length !== 3) return null;
			if (!OPERATORS.includes(tokens[1])) return null;
			const values = SFXFormulaMatcher._parseValues(tokens[2]);
			if (!values) return null;
			if (tokens[1] !== '==' && values.length > 1) return null;

			return { type: 'count', keyword, negated, faces, modifier, operator: tokens[1], values };
		}

		const match = DIE_TERM_RE.exec(tokens[0]);
		if (!match) return null;

		const count = match[1] ? (match[1] === '*' ? '*' : parseInt(match[1])) : null;
		const faces = parseInt(match[2]);

		let modifier = null;
		if (match[3]) {
			modifier = { type: match[3], params: null };
			if (match[4]) {
				if (!match[5]) return null;
				modifier.params = match[4] + match[5];
			}
		}

		if (tokens.length === 1) {
			return { type: 'dice', count, faces, modifier, operator: null, values: null };
		}

		if (tokens.length !== 3) return null;
		if (!OPERATORS.includes(tokens[1])) return null;
		const values = SFXFormulaMatcher._parseValues(tokens[2]);
		if (!values) return null;
		if (tokens[1] !== '==' && values.length > 1) return null;

		return { type: 'dice', count, faces, modifier, operator: tokens[1], values };
	}

	static _parseValues(str) {
		const parts = str.split(',');
		const values = [];
		for (const part of parts) {
			if (!/^\d+$/.test(part)) return null;
			values.push(parseInt(part));
		}
		return values.length > 0 ? values : null;
	}

	static _findMatchingParen(str, openIdx) {
		let depth = 1;
		for (let i = openIdx + 1; i < str.length; i++) {
			if (str[i] === '(') depth++;
			else if (str[i] === ')') {
				depth--;
				if (depth === 0) return i;
			}
		}
		return -1;
	}

	static _parseCountPredicate(formula) {
		const openIdx = formula.indexOf('(');
		const closeIdx = SFXFormulaMatcher._findMatchingParen(formula, openIdx);
		if (closeIdx === -1) return null;

		const inner = formula.slice(openIdx + 1, closeIdx).trim();
		if (!inner) return null;

		const innerParsed = SFXFormulaMatcher._doParse(inner);
		if (!innerParsed) return null;
		//inner must be a term-scoped dice predicate: explicit count or *, with an operator
		if (innerParsed.type !== 'dice') return null;
		if (innerParsed.count === null) return null;
		if (!innerParsed.operator || !innerParsed.values) return null;

		const tail = formula.slice(closeIdx + 1).trim();
		if (!tail) return null;

		const tailTokens = tail.split(/\s+/);
		if (tailTokens.length !== 2) return null;
		if (!OPERATORS.includes(tailTokens[0])) return null;
		const values = SFXFormulaMatcher._parseValues(tailTokens[1]);
		if (!values) return null;
		if (tailTokens[0] !== '==' && values.length > 1) return null;

		return {
			type: 'count_predicate',
			inner: innerParsed,
			operator: tailTokens[0],
			values
		};
	}

	static _validateCountPredicate(trimmed) {
		const openIdx = trimmed.indexOf('(');
		const closeIdx = SFXFormulaMatcher._findMatchingParen(trimmed, openIdx);
		if (closeIdx !== -1) {
			const tail = trimmed.slice(closeIdx + 1).trim();
			if (tail) {
				const tailTokens = tail.split(/\s+/);
				if (tailTokens.length === 2 && !OPERATORS.includes(tailTokens[0])) {
					return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorBadOperator", { op: tailTokens[0] }) };
				}
			}
		}
		return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorCountPredicate") };
	}

	static validate(formula) {
		if (typeof formula !== 'string' || !formula.trim()) {
			return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorEmpty") };
		}

		const trimmed = SFXFormulaMatcher._normalizeWhitespace(formula);
		const parsed = SFXFormulaMatcher.parse(trimmed);

		if (!parsed) {
			if (trimmed.startsWith('count(')) {
				return SFXFormulaMatcher._validateCountPredicate(trimmed);
			}

			const tokens = trimmed.split(/\s+/);

			if (tokens[0] === 'total') {
				if (tokens.length < 3) return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorTotalSyntax") };
				if (!OPERATORS.includes(tokens[1])) return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorBadOperator", { op: tokens[1] }) };
				return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorBadValue") };
			}

			const countMatch = COUNT_RE.exec(tokens[0]);
			if (countMatch) {
				if (tokens.length === 2) return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorIncomplete") };
				if (tokens.length > 3) return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorCountSyntax", { kw: countMatch[2] }) };
				if (tokens.length === 3 && !OPERATORS.includes(tokens[1])) return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorBadOperator", { op: tokens[1] }) };
				return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorCountBadDie", { kw: countMatch[2] }) };
			}

			const kwMatch = tokens[0].match(/^!?([a-z]+)\(/);
			if (kwMatch && !COUNT_KEYWORDS.includes(kwMatch[1]) && kwMatch[1] !== 'count') {
				return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorBadKeyword", { kw: kwMatch[1] }) };
			}

			if (trimmed.includes('+') || trimmed.includes('-')) {
				return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorCrossTerm") };
			}

			if (!/d\d/.test(tokens[0])) {
				return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorBadStart") };
			}

			const modMatch = tokens[0].match(/d\d+([a-z]+)/);
			if (modMatch && !SUPPORTED_MODIFIERS.includes(modMatch[1])) {
				return { valid: false, error: game.i18n.format("DICESONICE.sfxFormulaErrorBadModifier", { mod: modMatch[1] }) };
			}

			if (tokens.length === 2) {
				return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorIncomplete") };
			}

			if (tokens.length > 3) {
				return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorTooManyParts") };
			}

			return { valid: false, error: game.i18n.localize("DICESONICE.sfxFormulaErrorInvalid") };
		}

		return { valid: true, error: null };
	}

	static match(formula, context) {
		const { dice, rollTotal } = context;
		if (!dice || !dice.length) return [];

		const parsed = SFXFormulaMatcher.parse(formula);
		if (!parsed) return [];

		if (parsed.type === 'total') {
			return SFXFormulaMatcher._matchTotal(parsed, dice, rollTotal);
		}

		if (parsed.type === 'count') {
			return SFXFormulaMatcher._matchCount(parsed, dice);
		}

		if (parsed.type === 'count_predicate') {
			return SFXFormulaMatcher._matchCountPredicate(parsed, dice);
		}

		if (parsed.count === null) {
			return SFXFormulaMatcher._matchPerDie(parsed, dice);
		}

		return SFXFormulaMatcher._matchAggregate(parsed, dice);
	}

	static _matchTotal(parsed, dice, rollTotal) {
		if (rollTotal == null) return [];
		if (!SFXFormulaMatcher._compare(rollTotal, parsed.operator, parsed.values)) return [];
		return dice.filter(d => !d.options?.ghost);
	}

	static _matchCount(parsed, dice) {
		const formulaType = 'd' + parsed.faces;
		const flagValue = !parsed.negated;
		const matching = dice.filter(d => {
			if (d.options?.ghost) return false;

			const isType = (d.compositeType && d.compositeType === formulaType) || d.type === formulaType;
			if (!isType) return false;

			if (parsed.modifier) {
				if (!SFXFormulaMatcher._matchModifier(parsed.modifier, d.termModifiers)) return false;
			}

			return (d.fvttResult?.[parsed.keyword] === true) === flagValue;
		});

		if (parsed.operator && parsed.values) {
			if (!SFXFormulaMatcher._compare(matching.length, parsed.operator, parsed.values)) return [];
		}
		return matching;
	}

	static _matchPerDie(parsed, dice) {
		const formulaType = 'd' + parsed.faces;
		return dice.filter(d => {
			if (d.options?.ghost) return false;

			let result;
			if (d.compositeType && d.compositeType === formulaType) {
				result = d.compositeResult;
			} else if (d.type === formulaType) {
				result = d.result;
			} else {
				return false;
			}

			if (parsed.modifier) {
				if (!SFXFormulaMatcher._matchModifier(parsed.modifier, d.termModifiers)) return false;
			}

			if (parsed.operator && parsed.values) {
				return SFXFormulaMatcher._compare(result, parsed.operator, parsed.values);
			}

			return true;
		});
	}

	static _matchCountPredicate(parsed, dice) {
		const inner = parsed.inner;
		const formulaType = 'd' + inner.faces;

		//group by term, same as aggregate mode
		const termGroups = new Map();
		for (const d of dice) {
			if (d.options?.ghost) continue;
			if (d.termIndex == null) continue;
			if (!termGroups.has(d.termIndex)) termGroups.set(d.termIndex, []);
			termGroups.get(d.termIndex).push(d);
		}

		const matched = [];
		for (const [, group] of termGroups) {
			const rep = group[0];

			if (rep.termFaces !== inner.faces) continue;
			if (inner.count !== '*' && rep.termNumber !== inner.count) continue;

			if (inner.modifier) {
				if (!SFXFormulaMatcher._matchModifier(inner.modifier, rep.termModifiers)) continue;
			}

			//count the dice that pass the inner per-die predicate
			const passes = group.filter(d => {
				const result = (d.compositeType && d.compositeType === formulaType)
					? d.compositeResult
					: d.result;
				return SFXFormulaMatcher._compare(result, inner.operator, inner.values);
			});

			if (!SFXFormulaMatcher._compare(passes.length, parsed.operator, parsed.values)) continue;

			for (const d of passes) matched.push(d);
		}

		return matched;
	}

	static _matchAggregate(parsed, dice) {
		const termGroups = new Map();
		for (const d of dice) {
			if (d.options?.ghost) continue;
			if (d.termIndex == null) continue;
			if (!termGroups.has(d.termIndex)) termGroups.set(d.termIndex, []);
			termGroups.get(d.termIndex).push(d);
		}

		const matched = [];
		for (const [, group] of termGroups) {
			const rep = group[0];

			if (rep.termFaces !== parsed.faces) continue;
			if (parsed.count !== '*' && rep.termNumber !== parsed.count) continue;

			if (parsed.modifier) {
				if (!SFXFormulaMatcher._matchModifier(parsed.modifier, rep.termModifiers)) continue;
			}

			if (parsed.operator && parsed.values) {
				if (!SFXFormulaMatcher._compare(rep.termTotal, parsed.operator, parsed.values)) continue;
			}

			for (const d of group) {
				matched.push(d);
			}
		}

		return matched;
	}

	static _matchModifier(parsedMod, termModifiers) {
		if (!termModifiers || !termModifiers.length) return false;

		// DnD 5e uses "adv"/"dis" as aliases for "kh"/"kl"
		const aliases = parsedMod.type === 'kh' ? ['kh', 'adv'] : parsedMod.type === 'kl' ? ['kl', 'dis'] : [parsedMod.type];

		if (parsedMod.params === null) {
			return termModifiers.some(m => aliases.some(a => m.startsWith(a)));
		}

		return aliases.some(a => termModifiers.includes(a + parsedMod.params));
	}

	static _compare(value, operator, targets) {
		switch (operator) {
			case '==': return targets.includes(value);
			case '>=': return value >= targets[0];
			case '<=': return value <= targets[0];
			case '>':  return value > targets[0];
			case '<':  return value < targets[0];
			default: return false;
		}
	}
}
