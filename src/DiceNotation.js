import { DiceSFXManager } from './sfx/DiceSFXManager.js';
import { SFXFormulaMatcher } from './sfx/SFXFormulaMatcher.js';
import { DiceLibrary } from './engine/DiceLibrary.js';

export const COMPOUND_DICE = {
	100:   [{ type: 'd100',   divisor: 10   }, { type: 'd10',  divisor: 1    }],
	1000:  [{ type: 'd1000',  divisor: 100  }, { type: 'd100', divisor: 10   }, { type: 'd10', divisor: 1 }],
	10000: [{ type: 'd10000', divisor: 1000 }, { type: 'd1000', divisor: 100 }, { type: 'd100', divisor: 10 }, { type: 'd10', divisor: 1 }]
};

export class DiceNotation {

	/**
	 * A roll object from Foundry 
	 * @param {Roll} rolls 
	 */
	constructor(rolls, userConfig = null, user = game.user) {
		this.throws = [{dice:[]}];
		this.userConfig = userConfig;
		this.user = user;
		this.rollTotal = null;
		this.messageId = null;
		
		//First we need to prepare the data
		rolls.dice.forEach(die => {
			//We only are able to handle this list of number of face in 3D for now
			if([2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 100, 1000, 10000].includes(die.faces)) {
				//We flag every single die with a throw number, to queue exploded dice
				let cnt = die.results.filter(r => !r.rerolled && !r.exploded).length;
				let countExtraDice = 0;
				let localNbThrow = 0;

				if(die.number === 0 && die.results.length > 0)
					localNbThrow = 1;
				for(let i =0; i< die.results.length; i++){
					if(localNbThrow >= this.throws.length)
						this.throws.push({dice:[]});

					if(die.results[i].exploded || die.results[i].rerolled)
						countExtraDice++;
					die.results[i].indexThrow = localNbThrow;
					/*
					 * Note for the future:
					 * This line has been added, then moved then changed already 3 times. Therefore here is some information:
					 * .discarded dice should be shown in the 3D view. They are only natively used by keep/drop modifers
					 * .hidden is a Dice So Nice specific flag, to hide the dice from the 3D view.
					 * At some point, the newThrow trigger was skipped based on Discarded, because some modules and systems do the following:
					 * They create a first ChatMessage containing a roll, then they let users alter the roll but to do so, they delete the first ChatMessage
					 * Then they create a second ChatMessage containing the same roll, containing all the dice, old and new, using .discarded to flag rerolled dice.
					 *
					 * The current approach uses the hidden flag combined with the discarded/rerolled flag.
					 */
					if (die.results[i].hidden && (die.results[i].discarded || die.results[i].rerolled)) continue; //Continue if die result is not shown and is discarded or rerolled
					
					//If we have a new throw
					if(--cnt <= 0){
						localNbThrow++;
						cnt = countExtraDice;
						countExtraDice = 0;
					}
				}
			}
		});
		let diceNumber = 0;
		let maxDiceNumber = game.settings.get("dice-so-nice", "maxDiceNumber");
		let termIndex = 0;
		//Then we can create the throws
		rolls.dice.some(die => {
			//We only are able to handle this list of number of face in 3D for now
			if([2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 100, 1000, 10000].includes(die.faces)) {
				let options = {};
				for(let i =0; i< die.results.length; i++){
					if(++diceNumber >= maxDiceNumber)
						return true;
					if(!die.results[i].hidden){
						//save the user in the options
						options.owner = user.id;

						//ghost can't be secret
						if(rolls.ghost)
							options.ghost = true;
						else if(rolls.secret)
							options.secret = true;

						if(die.modifiers.length)
							options.modifiers = die.modifiers;

						const places = COMPOUND_DICE[die.faces];
						if (places) {
							const compositeType = 'd' + die.faces;
							for (let p = 0; p < places.length; p++) {
								this.addDie({fvttDie: die, index:i, digitPlace: places[p], compositeType, isCompoundPrimary: p === 0, options:options, termIndex});
							}
						} else {
							this.addDie({fvttDie: die, index:i, options:options, termIndex});
						}
					}
				}
			}
			termIndex++;
		});
	}
	addDie({fvttDie, index, digitPlace = null, compositeType = null, isCompoundPrimary = false, options = {}, termIndex = null}){
		let dsnDie = {};
		let dieValue = fvttDie.results[index].result;

		if(digitPlace) {
			const rawDigit = Math.floor(dieValue / digitPlace.divisor);
			const digit = rawDigit % 10;
			dsnDie.resultLabel = fvttDie.getResultLabel({result: digit * digitPlace.divisor});
			dieValue = digit;
			dsnDie.compositeResult = fvttDie.results[index].result;
			dsnDie.compositeType = compositeType;
		} else {
			dsnDie.resultLabel = fvttDie.getResultLabel({result:dieValue});
		}

		dsnDie.result = dieValue;
		dsnDie.fvttResult = fvttDie.results[index];

		const Die = foundry.dice.terms.Die;
		const denomination = fvttDie.constructor.DENOMINATION;
		if(digitPlace) {
			if(isCompoundPrimary && !(fvttDie instanceof Die && denomination === Die.DENOMINATION))
				dsnDie.type = "d" + denomination;
			else
				dsnDie.type = digitPlace.type;
		} else {
			if(fvttDie instanceof Die && denomination === Die.DENOMINATION)
				dsnDie.type = "d" + fvttDie.faces;
			else
				dsnDie.type = "d" + denomination;
		}

		dsnDie.vectors = [];
		dsnDie.options = foundry.utils.duplicate(fvttDie.options);
		foundry.utils.mergeObject(dsnDie.options, options);

		if (typeof dsnDie.options.flavor === "string" && dsnDie.options.flavor.startsWith("die:")) {
			const remainder = dsnDie.options.flavor.slice(4);
			const colonIdx = remainder.indexOf(":");
			let targetUser, dieName;
			if (colonIdx !== -1) {
				const userName = remainder.slice(0, colonIdx);
				dieName = remainder.slice(colonIdx + 1);
				targetUser = game.users.find(u => u.name.toLowerCase() === userName.toLowerCase());
			} else {
				dieName = remainder;
				targetUser = this.user;
			}
			if (targetUser && dieName) {
				const libraryDie = DiceLibrary.getByNameAndTypeForUser(targetUser, dieName, dsnDie.type);
				if (libraryDie) {
					if (!dsnDie.options.appearance) dsnDie.options.appearance = {};
					dsnDie.options.appearance.libraryDieId = libraryDie.id;
					if (targetUser.id !== this.user.id) {
						dsnDie.options.appearance.libraryDieOwner = targetUser.id;
					}
				}
			}
			delete dsnDie.options.flavor;
		} else if(this.userConfig && !this.userConfig.enableFlavorColorset) {
			if(dsnDie.options.flavor) delete dsnDie.options.flavor;
			if(dsnDie.options.type) delete dsnDie.options.type;
		}

		dsnDie.termIndex = termIndex;
		dsnDie.termNumber = fvttDie.number ?? null;
		dsnDie.termTotal = fvttDie.total ?? null;
		dsnDie.termFaces = fvttDie.faces ?? null;
		dsnDie.termModifiers = fvttDie.modifiers ? [...fvttDie.modifiers] : [];

		this.throws[dsnDie.fvttResult.indexThrow].dice.push(dsnDie);
	}

	static mergeQueuedRollCommands(queue){
		let mergedRollCommands = [];
		queue.forEach(command => {
			for(let i = 0; i< command.params.throws.length; i++){
				if(!mergedRollCommands[i])
					mergedRollCommands.push([]);
				command.params.throws[i].dsnConfig = command.params.dsnConfig;
				command.params.throws[i].rollTotal = command.params.rollTotal ?? null;
				command.params.throws[i].messageId = command.params.messageId ?? null;
				mergedRollCommands[i].push(command.params.throws[i]);
			}
		});
		//First we loop on the command list
		for(let i=0;i<mergedRollCommands.length;i++){
			//Then we loop on throws
			for(let j=0;j<mergedRollCommands[i].length;j++){

				let sfxList = mergedRollCommands[i][j].dsnConfig.specialEffects;
				const allDice = mergedRollCommands[i][j].dice;
				const rollTotal = mergedRollCommands[i][j].rollTotal;
				const messageId = mergedRollCommands[i][j].messageId;
				const sfxEntries = Object.values(sfxList);

				// advanced formula SFX: evaluate per-formula across all dice
				for (const sfx of sfxEntries) {
					if (sfx.mode !== 'advanced' || !sfx.formula) continue;
					const matchedDice = SFXFormulaMatcher.match(sfx.formula, { dice: allDice, rollTotal });
					const sfxClass = DiceSFXManager.SFX_MODE_CLASS?.[sfx.specialEffect];
					const oncePerMesh = sfxClass?.PLAY_ONLY_ONCE_PER_MESH;
					for (const die of matchedDice) {
						if (oncePerMesh && die.compositeType && die.type !== die.compositeType) continue;
						if (!die.specialEffects) die.specialEffects = [];
						die.specialEffects.push({
							specialEffect: sfx.specialEffect,
							options: sfx.options || {},
							_messageId: messageId
						});
					}
				}

				// basic SFX: evaluate per-die (existing logic)
				for(let k=0;k<allDice.length;k++){
					const dsnDie = allDice[k];
					let specialEffects = sfxEntries.filter(sfx => {
						if (sfx.mode === 'advanced') return false;

						if(dsnDie.fvttResult?.discarded)
							return false;

						if(dsnDie.options.ghost)
							return false;

						let manualResultTrigger = false;
						const mods = dsnDie.options?.modifiers;
						if(sfx.onResult.includes("kh") && mods?.some(m => m.startsWith("kh") || m.startsWith("adv")))
							manualResultTrigger = true;
						if(sfx.onResult.includes("kl") && mods?.some(m => m.startsWith("kl") || m.startsWith("dis")))
							manualResultTrigger = true;
						if(sfx.onResult.includes("dh") && mods?.some(m => m.startsWith("dh")))
							manualResultTrigger = true;
						if(sfx.onResult.includes("dl") && mods?.some(m => m.startsWith("dl")))
							manualResultTrigger = true;
						if(sfx.onResult.includes("cs") && dsnDie.fvttResult?.success)
							manualResultTrigger = true;
						if(sfx.onResult.includes("cf") && dsnDie.fvttResult?.failure)
							manualResultTrigger = true;
						if(sfx.onResult.includes("x") && dsnDie.fvttResult?.exploded)
							manualResultTrigger = true;
						if(sfx.onResult.includes("r") && dsnDie.fvttResult?.rerolled)
							manualResultTrigger = true;

						if(manualResultTrigger)
							return true;

						if(dsnDie.compositeType && sfx.diceType === dsnDie.compositeType){
							const sfxClass = DiceSFXManager.SFX_MODE_CLASS?.[sfx.specialEffect];
							if(sfxClass?.PLAY_ONLY_ONCE_PER_MESH && dsnDie.type !== sfx.diceType) return false;
							if(sfx.onResult.includes(dsnDie.compositeResult.toString()))
								return true;
						} else {
							if(sfx.diceType == dsnDie.type && sfx.onResult.includes(dsnDie.result.toString()))
								return true;
						}

						if(dsnDie.options.sfx && dsnDie.options.sfx.id == sfx.diceType && sfx.onResult.includes(dsnDie.options.sfx.result.toString()))
							return true;

						return false;
					});
					if(dsnDie.options.sfx && dsnDie.options.sfx.specialEffect)
						specialEffects.push({
							specialEffect:dsnDie.options.sfx.specialEffect,
							options:dsnDie.options.sfx.options
						});
					if(specialEffects.length){
						specialEffects = specialEffects.map(s => ({...s, _messageId: messageId}));
						specialEffects = specialEffects.filter((v, i, a) => a.findIndex(x => x.specialEffect === v.specialEffect) === i);
						if (!dsnDie.specialEffects) dsnDie.specialEffects = [];
						dsnDie.specialEffects.push(...specialEffects);
					}
				}

				// dedup across basic and advanced entries
				for (const dsnDie of allDice) {
					if (dsnDie.specialEffects) {
						dsnDie.specialEffects = dsnDie.specialEffects.filter(
							(v, i, a) => a.findIndex(x => x.specialEffect === v.specialEffect) === i
						);
					}
				}
			}
		}
		return mergedRollCommands;
	}
}
