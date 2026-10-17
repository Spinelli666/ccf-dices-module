// Modified by ccf-web (2026-10-12) from Dice So Nice 6.2.9 (AGPL-3.0): asset URLs made absolute (/modules/dice-so-nice/...).
import { emissive } from "three/tsl";
import { AssetsLoader } from "../AssetsLoader.js";

export const TEXTURELIST = {
	'none': {
		name: 'DICESONICE.TextureNone',
		composite: 'source-over',
		source: '',
		bump: ''
	},
	'cloudy': {
		name: 'DICESONICE.TextureCloudsTransparent',
		composite: 'destination-in',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'cloudy.webp',
		bump: 'cloudy.alt.webp'
	},
	'cloudy_2': {
		name: 'DICESONICE.TextureClouds',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'cloudy.alt.webp',
		bump: 'cloudy.alt.webp'
	},
	'fire': {
		name: 'DICESONICE.TextureFire',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'fire.webp',
		bump: 'fire.webp'
	},
	'marble': {
		name: 'DICESONICE.TextureMarble',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'marble.webp',
		bump: '',
		material: "glass"
	},
	'water': {
		name: 'DICESONICE.TextureWaterTransparent',
		composite: 'destination-in',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'water.webp',
		bump: 'water.webp',
		material: 'glass',
	},
	'water_2': {
		name: 'DICESONICE.TextureWater',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'water.webp',
		bump: 'water.webp',
		material: 'glass',
	},
	'ice': {
		name: 'DICESONICE.TextureIceTransparent',
		composite: 'destination-in',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'ice.webp',
		bump: 'ice.webp',
		material: 'glass'
	},
	'ice_2': {
		name: 'DICESONICE.TextureIce',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'ice.webp',
		bump: 'ice.webp',
		material: 'glass'
	},
	'paper': {
		name: 'DICESONICE.TexturePaper',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'paper.webp',
		bump: 'paper_bump.webp',
		material: 'wood'
	},
	'speckles': {
		name: 'DICESONICE.TextureSpeckles',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'speckles.webp',
		bump: 'speckles.webp'
	},
	'glitter': {
		name: 'DICESONICE.TextureGlitter',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'glitter.webp',
		bump: 'glitter_bump.webp'
	},
	'glitter_2': {
		name: 'DICESONICE.TextureGlitterTransparent',
		composite: 'destination-in',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'glitter-alpha.webp',
		bump: ''
	},
	'stars': {
		name: 'DICESONICE.TextureStars',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'stars.webp',
		bump: 'stars.webp'
	},
	'stainedglass': {
		name: 'DICESONICE.TextureStainedGlass',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'stainedglass.webp',
		bump: 'stainedglass_bump.webp',
		material: 'iridescent'
	},
	'skulls': {
		name: 'DICESONICE.TextureSkulls',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'skulls.webp',
		bump: 'skulls.webp'
	},
	'leopard': {
		name: 'DICESONICE.TextureLeopard',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'leopard.webp',
		bump: 'leopard.webp',
		material: 'wood'
	},
	'tiger': {
		name: 'DICESONICE.TextureTiger',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'tiger.webp',
		bump: 'tiger.webp',
		material: 'wood'
	},
	'cheetah': {
		name: 'DICESONICE.TextureCheetah',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'cheetah.webp',
		bump: 'cheetah.webp',
		material: 'wood'
	},
	'dragon': {
		name: 'DICESONICE.TextureDragon',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'dragon.webp',
		bump: 'dragon_bump.webp'
	},
	'lizard': {
		name: 'DICESONICE.TextureLizard',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'lizard.webp',
		bump: 'lizard_bump.webp'
	},
	'bird': {
		name: 'DICESONICE.TextureBird',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'feather.webp',
		bump: 'feather_bump.webp'
	},
	'astral': {
		name: 'DICESONICE.TextureAstralSea',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'astral.webp',
		bump: 'stars.webp'
	},
	'wood': {
		name: 'DICESONICE.TextureWood',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'wood.webp',
		bump: 'wood.webp',
		material: 'wood'
	},
	'metal': {
		name: 'DICESONICE.TextureMetal',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'metal.webp',
		bump: '',
		material: 'metal'
	},
	'stone': {
		name: 'DICESONICE.TextureStone',
		composite: 'soft-light',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'stone.webp',
		bump: 'stone.webp',
		material: 'stone'
	},
	'radial': {
		name: 'DICESONICE.TextureRadial',
		composite: 'source-over',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'radial.webp',
		bump: '',
	},
	'bronze01': {
		name: 'DICESONICE.TextureBronze1',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'bronze01.webp',
		material: 'metal',
		bump: ''
	},
	'bronze02': {
		name: 'DICESONICE.TextureBronze2',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'bronze02.webp',
		material: 'metal',
		bump: ''
	},
	'bronze03': {
		name: 'DICESONICE.TextureBronze3',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'bronze03.webp',
		material: 'metal',
		bump: ''
	},
	'bronze03a': {
		name: 'DICESONICE.TextureBronze3a',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'bronze03a.webp',
		material: 'metal',
		bump: ''
	},
	'bronze03b': {
		name: 'DICESONICE.TextureBronze3b',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'bronze03b.webp',
		material: 'metal',
		bump: ''
	},
	'bronze04': {
		name: 'DICESONICE.TextureBronze4',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'bronze04.webp',
		material: 'metal',
		bump: ''
	},
	'brick': {
		name: 'DICESONICE.TextureBrick',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'brick.webp',
		bump: 'brick.webp',
		material: 'stone'
	},
	'fiber': {
		name: 'DICESONICE.TextureFiber',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'fiber.webp',
		bump: 'fiber.webp'
	},
	'fuel': {
		name: 'DICESONICE.TextureFuel',
		composite: 'difference',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'fuel.webp',
		bump: 'fuel.webp'
	},
	'watercolor': {
		name: 'DICESONICE.TextureWatercolor',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'watercolor.webp',
		bump: ''
	},
	'alienrock': {
		name: 'DICESONICE.TextureAlienRock',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'alienrock.webp',
		bump: 'alienrock_bump.webp'
	},
	'hell': {
		name: 'DICESONICE.TextureHell',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'hell.webp',
		bump: 'hell_bump.webp'
	},
	'lava': {
		name: 'DICESONICE.TextureLava',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'lava.webp',
		bump: 'lava_bump.webp'
	},
	'portal': {
		name: 'DICESONICE.TexturePortal',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'portal.webp',
		bump: ''
	},
	'tile': {
		name: 'DICESONICE.TextureTile',
		composite: 'multiply',
		atlas: "/modules/dice-so-nice/textures/standard.json",
		source: 'tile.webp',
		bump: 'tile_bump.webp'
	}
};

export const COLORSETS = {
	'coin_default': {
		name: 'coin_default',
		description: 'DICESONICE.ColorCoinDefault',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#f6c928',
		background: '#f6c928',
		outline: 'none',
		edge: '#f6c928',
		texture: 'metal',
		visibility: 'hidden'
	},
	'spectrum_default': {
		name: 'spectrum_default',
		description: 'DICESONICE.ColorSpectrumDefault',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#ffffff',
		background: '#000000',
		outline: '#ffffff',
		edge: '#000000',
		texture: 'none',
		visibility: 'hidden',
		material: 'pristine'
	},
	'radiant': {
		name: 'radiant',
		description: 'DICESONICE.ColorRadiant',
		category: 'DICESONICE.DamageTypes',
		foreground: '#e7a427',
		background: '#d0f4ff',
		outline: '#292929',
		texture: 'bronze04',
	},
	'fire': {
		name: 'fire',
		description: 'DICESONICE.ColorFire',
		category: 'DICESONICE.DamageTypes',
		foreground: '#ede2b2',
		background: ['#ffeea4','#ffdc9c','#fac8b8','#910200','#814841'],
		outline: 'black',
		texture: 'lava',
		material: 'plastic'
	},
	'ice': {
		name: 'ice',
		description: 'DICESONICE.ColorIce',
		category: 'DICESONICE.DamageTypes',
		foreground: '#60E9FF',
		background: ['#214fa3','#3c6ac1','#253f70','#0b56e2','#09317a'],
		outline: 'black',
		texture: 'ice'
	},
	'cold': {
		name: 'cold',
		description: 'DICESONICE.ColorCold',
		category: 'DICESONICE.DamageTypes',
		foreground: '#60E9FF',
		background: ['#214fa3','#3c6ac1','#253f70','#0b56e2','#09317a'],
		outline: 'black',
		texture: 'ice_2'
	},
	'poison': {
		name: 'poison',
		description: 'DICESONICE.ColorPoison',
		category: 'DICESONICE.DamageTypes',
		foreground: '#D6A8FF',
		background: ['#313866','#504099','#66409e','#934fc3','#c949fc'],
		outline: 'black',
		texture: 'cloudy'
	},
	'acid': {
		name: 'acid',
		description: 'DICESONICE.ColorAcid',
		category: 'DICESONICE.DamageTypes',
		foreground: '#ffd8ae',
		background: ['#a6ff00', '#83b625','#5ace04','#69f006','#b0f006','#93bc25'],
		outline: '#ed7b00',
		texture: 'marble',
		material: 'iridescent'
	},
	'thunder': {
		name: 'thunder',
		description: 'DICESONICE.ColorThunder',
		category: 'DICESONICE.DamageTypes',
		foreground: '#FFC500',
		background: '#131417',
		outline: 'black',
		texture: 'cloudy',
		emissiveLabels: true
	},
	'lightning': {
		name: 'lightning',
		description: 'DICESONICE.ColorLightning',
		category: 'DICESONICE.DamageTypes',
		foreground: '#62430d',
		background: ['#f17105', '#f3ca40','#eddea4','#df9a57','#dea54b'],
		outline: '#7D7D7D',
		texture: 'ice'
	},
	'air': {
		name: 'air',
		description: 'DICESONICE.ColorAir',
		category: 'DICESONICE.DamageTypes',
		foreground: '#ffffff',
		background: ['#bae4ee', '#add6e0','#8bc1ce','#7dafba','#6a9eac'],
		outline: '#19147c',
		edge: '#e3e2ee',
		texture: 'cloudy',
		material: 'chrome'
	},
	'water': {
		name: 'water',
		description: 'DICESONICE.ColorWater',
		category: 'DICESONICE.DamageTypes',
		foreground: '#2a646d',
		background: ['#75c2c4', '#66b5b9','#5f96ab','#5b8691','#5f9faf'],
		outline: '#b8effd',
		texture: 'water'
	},
	'earth': {
		name: 'earth',
		description: 'DICESONICE.ColorEarth',
		category: 'DICESONICE.DamageTypes',
		foreground: '#6C9943',
		background: ['#346804', '#184200','#55741b', '#3a1d04', '#56341a','#331c17','#5a352a','#302210'],
		outline: '#b1c1a2',
		texture: 'speckles'
	},
	'force': {
		name: 'force',
		description: 'DICESONICE.ColorForce',
		category: 'DICESONICE.DamageTypes',
		foreground: 'white',
		background: ['#FF97FF', '#FF68FF','#C651C6'],
		outline: '#570000',
		texture: 'stars'
	},
	'psychic': {
		name: 'psychic',
		description: 'DICESONICE.ColorPsychic',
		category: 'DICESONICE.DamageTypes',
		foreground: '#D6A8FF',
		background: ['#313866','#504099','#66409E','#934FC3','#C949FC','#313866'],
		outline: 'black',
		texture: 'speckles'
	},
	'necrotic': {
		name: 'necrotic',
		description: 'DICESONICE.ColorNecrotic',
		category: 'DICESONICE.DamageTypes',
		foreground: '#ffffff',
		background: '#6F0000',
		outline: 'black',
		texture: 'skulls'
	},
	'breebaby': {
		name: 'breebaby',
		description: 'DICESONICE.ColorPastelSunset',
		category: 'DICESONICE.ThemesSoNice',
		foreground: ['#620162', '#40135f','#45455E','#23585f','#095b63','#582420','#5f0a19','#132e5e','#0e1362'],
		background: ['#FE89CF', '#DFD4F2','#C2C2E8','#CCE7FA','#A1D9FC','#F3C3C2','#EB8993','#8EA1D2','#7477AD'],
		outline: 'white',
		texture: 'marble',
		material: 'plastic'
	},
	'pinkdreams': {
		name: 'pinkdreams',
		description: 'DICESONICE.ColorPinkDreams',
		category: 'DICESONICE.ThemesSoNice',
		foreground: 'white',
		background: ['#ff007c', '#df73ff','#f400a1','#df00ff','#ff33cc'],
		outline: '#170000',
		texture: 'skulls'
	},
	'inspired': {
		name: 'inspired',
		description: 'DICESONICE.ColorInspired',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#FFD800',
		background: '#C4C4B6',
		outline: '#000000',
		texture: 'stone'
	},
	'bloodmoon': {
		name: 'bloodmoon',
		description: 'DICESONICE.ColorBloodMoon',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#CDB800',
		background: '#6F0000',
		outline: 'black',
		texture: 'marble',
		material: 'plastic'
	},
	'starynight': {
		name: 'starynight',
		description: 'DICESONICE.ColorStaryNight',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#4F708F',
		background: ['#091636','#233660','#4F708F','#8597AD','#E2E2E2'],
		outline: 'white',
		texture: 'speckles'
	},
	'glitterparty': {
		name: 'glitterparty',
		description: 'DICESONICE.ColorGlitterParty',
		category: 'DICESONICE.ThemesSoNice',
		foreground: 'white',
		background: ['#FFB5F5','#7FC9FF','#A17FFF'],
		outline: 'none',
		texture: 'glitter'
	},
	'astralsea': {
		name: 'astralsea',
		description: 'DICESONICE.ColorAstralSea',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#1a0263',
		background: '#a6a1b3',
		outline: '#d2d2d2',
		texture: 'astral'
	},
	'foundry': {
		name: 'foundry',
		description: 'DICESONICE.ColorFoundry',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#000000',
		background: '#8c8c8c',
		outline: '#000000',
		edge: '#000000',
		texture: 'radial'
	},
	'dragons': {
		name: 'dragons',
		description: 'DICESONICE.ColorDragons',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#FFFFFF',
		// 			[ red,       black,     blue,      green      white      gold,      silver,    bronze,    copper     brass
		background: ['#B80000', '#4D5A5A', '#5BB8FF', '#7E934E', '#FFFFFF', '#F6ED7C', '#7797A3', '#A78437', '#862C1A', '#FFDF8A'],
		outline: 'black',
		texture: ['dragon', 'lizard'],
	},
	'birdup': {
		name: 'birdup',
		description: 'DICESONICE.ColorBirdUp',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#FFFFFF',
		background: ['#F11602', '#FFC000', '#6EC832', '#0094BC', '#05608D', '#FEABB3', '#F75680', '#F3F0DF', '#C7A57F'],
		outline: 'black',
		texture: 'bird',
	},
	'hell': {
		name: 'hell',
		description: 'DICESONICE.ColorHell',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#ffffff',
		background: '#a6a6a6',
		outline: 'black',
		texture: 'hell',
		material: 'plastic'
	},
	'tigerking': {
		name: 'tigerking',
		description: 'DICESONICE.ColorTigerKing',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#ffffff',
		background: '#FFCC40',
		outline: 'black',
		texture: ['leopard', 'tiger', 'cheetah']
	},
	'toxic': {
		name: 'toxic',
		description: 'DICESONICE.ColorToxic',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#ccffab',
		background: ['#a6ff00', '#83b625','#5ace04','#69f006','#b0f006','#93bc25'],
		outline: 'black',
		texture: 'fire',
		material: 'glass'
	},
	'rainbow': {
		name: 'rainbow',
		description: 'DICESONICE.ColorRainblow',
		category: 'DICESONICE.Colors',
		foreground: ['#FF5959','#FFA74F','#FFFF56','#59FF59','#2374FF','#00FFFF','#FF59FF'],
		background: ['#900000','#CE3900','#BCBC00','#00B500','#00008E','#008282','#A500A5'],
		outline: 'black',
		texture: 'none'
	},
	'random': {
		name: 'random',
		description: 'DICESONICE.ColorRaNdOm',
		category: 'DICESONICE.Colors',
		foreground: [],
		outline: [],
		background: [],
		texture: [],
		material: []
	},
	'black': {
		name: 'black',
		description: 'DICESONICE.ColorBlack',
		category: 'DICESONICE.Colors',
		foreground: '#ffffff',
		background: '#000000',
		outline: 'black',
		texture: 'none'
	},
	'white': {
		name: 'white',
		description: 'DICESONICE.ColorWhite',
		category: 'DICESONICE.Colors',
		foreground: '#000000',
		background: '#FFFFFF',
		outline: '#FFFFFF',
		texture: 'none'
	},
	'grey': {
		name: 'grey',
		description: 'DICESONICE.ColorGrey',
		category: 'DICESONICE.Colors',
		foreground: '#FFFFFF',
		background: '#888888',
		outline: '#000000',
		texture: 'none'
	},
	'red': {
		name: 'red',
		description: 'DICESONICE.ColorRed',
		category: 'DICESONICE.Colors',
		foreground: '#FFFFFF',
		background: '#FF0000',
		outline: 'none',
		texture: 'none'
	},
	'blue': {
		name: 'blue',
		description: 'DICESONICE.ColorBlue',
		category: 'DICESONICE.Colors',
		foreground: '#FFFFFF',
		background: '#0000FF',
		outline: 'none',
		texture: 'none'
	},
	'green': {
		name: 'green',
		description: 'DICESONICE.ColorGreen',
		category: 'DICESONICE.Colors',
		foreground: '#FFFFFF',
		background: '#00FF00',
		outline: 'none',
		texture: 'none'
	},
	'yellow': {
		name: 'yellow',
		description: 'DICESONICE.ColorYellow',
		category: 'DICESONICE.Colors',
		foreground: '#FFFFFF',
		background: '#FFFF00',
		outline: '#333333',
		texture: 'none'
	},
	'pink': {
		name: 'pink',
		description: 'DICESONICE.ColorPink',
		category: 'DICESONICE.Colors',
		foreground: '#FFFFFF',
		background: '#FF00FF',
		outline: 'none',
		texture: 'none'
	},
	'cyan': {
		name: 'cyan',
		description: 'DICESONICE.ColorCyan',
		category: 'DICESONICE.Colors',
		foreground: '#000000',
		background: '#00FFFF',
		outline: 'none',
		texture: 'none'
	},
	'prism': {
		name: 'prism',
		description: 'DICESONICE.ColorPrism',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#FFFFFF',
		background: '#8396be',
		outline: 'black',
		texture: 'stainedglass'
	},
	'alienrock': {
		name: 'alienrock',
		description: 'DICESONICE.ColorAlienRock',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#ffffff',
		background: '#8baa83',
		outline: 'black',
		texture: 'alienrock'
	},
	'portal': {
		name: 'portal',
		description: 'DICESONICE.ColorPortal',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#ffffff',
		background: '#c7c7c7',
		outline: 'black',
		texture: 'portal'
	},
	'tile': {
		name: 'tile',
		description: 'DICESONICE.ColorTile',
		category: 'DICESONICE.ThemesSoNice',
		foreground: '#ffffff',
		background: '#e3e3e3',
		outline: 'black',
		texture: 'tile'
	},
	'bronze': {
		name: 'bronze',
		description: 'DICESONICE.ColorBronze',
		category: 'DICESONICE.ThemesSoNice',
		foreground: ['#FF9159','#FFB066','#FFBF59','#FFD059'],
		background: ['#705206','#7A4E06','#643100','#7A2D06'],
		outline: ['#3D2D03','#472D04','#301700','#471A04'],
		edge: ['#FF5D0D','#FF7B00','#FFA20D','#FFBA0D'],
		texture: ['bronze01','bronze02','bronze03','bronze03b','bronze03b','bronze04']
	},
	'amber': {
		name: 'amber',
		description: 'DICESONICE.ColorAmber',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#ffd700',
		background: '#c87533',
		outline: '#8b4513',
		edge: '#b8860b',
		texture: 'none',
		material: 'resin'
	},
	'sea_glass': {
		name: 'sea_glass',
		description: 'DICESONICE.ColorSeaGlass',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#ffffff',
		background: '#a8d8d8',
		outline: '#5f9ea0',
		edge: '#88c0c0',
		texture: 'none',
		material: 'frosted'
	},
	'royal_velvet': {
		name: 'royal_velvet',
		description: 'DICESONICE.ColorRoyalVelvet',
		category: 'DICESONICE.AcquiredTaste',
		foreground: '#f5deb3',
		background: '#4a0e4e',
		outline: '#2d0a2e',
		edge: '#6b1a6e',
		texture: 'none',
		material: 'velvet'
	},
	'custom': {
		name: 'custom',
		description: 'DICESONICE.ColorCustom',
		category: 'DICESONICE.Colors',
		foreground: '',
		background: '',
		outline: '',
		edge: '',
		texture: 'none'
	}
};

export const DICE_SCALE = {
	"d2":1,
	"d4":1,
	"d6":1.3,
	"d8":1.1,
	"d10":1,
	"d12":1.1,
	"d14":0.5,
	"d16":0.5,
	"d20":1,
	"d24":1,
	"d30":0.75,
	"d3":1.3,
	"d5":1,
	"d7":0.5,
	"df":2,
	"d100":0.75,
	"d1000":0.55,
	"d10000":0.45
};

export class DiceColors {

	static diceTextures = {};
	static diceBumps = {};

	static loadTextures(sources, callback) {
		// Retrieve all the file paths (textures and atlases) from the sources object
		// Loop through them and add them to a list
		const textureList = []
		const itemprops = Object.entries(sources);
		for (const [key, value] of itemprops) {
			// If there's an atlas, we load the atlas. If not, we load the source and the bump
			if(value.atlas) {
				textureList.push(value.atlas);
			} else {
				if(value.source && value.source !== '') {
					textureList.push(value.source);
				}
				if(value.bump && value.bump !== '') {
					textureList.push(value.bump);
				}
			}
		}
		
		const loader = new AssetsLoader();
		loader.load(textureList).then((resources) => {
			// Now we can set the textures and bump textures in the diceTextures and diceBumps object
			for (const [key, value] of itemprops) {

				if(value.atlas) {
					if(value.source && value.source !== '')
						DiceColors.diceTextures[key] = resources[value.atlas][value.source];
					if(value.bump && value.bump !== '')
						DiceColors.diceBumps[key] = resources[value.atlas][value.bump];
				} else {
					if(value.source && value.source !== '') {
						DiceColors.diceTextures[key] = resources[value.source];
					}
					if(value.bump && value.bump !== '') {
						DiceColors.diceBumps[key] = resources[value.bump];
					}
				}
			}

			callback(resources);
		});
	}
	
	static registerCustomTexture(path, composite = "multiply") {
		const key = `custom:${path}`;
		const textureEntry = {
			name: path.split("/").pop(),
			composite,
			source: path,
			bump: ''
		};
		TEXTURELIST[key] = textureEntry;
		return new Promise((resolve) => {
			DiceColors.loadTextures({ [key]: textureEntry }, () => resolve(key));
		});
	}

	static getTexture(texturename) {
	
		if (Array.isArray(texturename)) {
	
			let textures = [];
			for(let i = 0, l = texturename.length; i < l; i++){
				if (typeof texturename[i] == 'string' || Array.isArray(texturename[i])) {
					textures.push(this.getTexture(texturename[i]));
				}
			}
			return textures;
		}
	
		if (!texturename || texturename == '') {
			return {name:'',texture:'',material:"plastic"};
		}
	
		if (texturename == 'none') {
			return {name:'none',texture:'',material:"plastic"};
		}
	
		if(texturename == 'random') {
			let names = Object.keys(DiceColors.diceTextures).filter(k => !k.startsWith("custom:"));
			return this.getTexture(names[Math.floor(Math.random() * names.length)]);
		}
		//Init not done yet, let the init load the texture
		if(!DiceColors.diceTextures)
			return texturename;
		if (DiceColors.diceTextures[texturename] != null) {
			if(!TEXTURELIST[texturename].material)
				TEXTURELIST[texturename].material = "plastic";
			if(!DiceColors.diceBumps[texturename])
				DiceColors.diceBumps[texturename] = '';
			return { name: texturename, bump: DiceColors.diceBumps[texturename], material: TEXTURELIST[texturename].material, texture: DiceColors.diceTextures[texturename], composite: TEXTURELIST[texturename].composite };
		}
		return {name:'',texture:''};
	}
	
	static hexToHSL(hex) {
		let r = parseInt(hex.slice(1, 3), 16) / 255;
		let g = parseInt(hex.slice(3, 5), 16) / 255;
		let b = parseInt(hex.slice(5, 7), 16) / 255;
		let max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, l = (max + min) / 2;
		if (max === min) {
			h = s = 0;
		} else {
			let d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
				case g: h = ((b - r) / d + 2) / 6; break;
				case b: h = ((r - g) / d + 4) / 6; break;
			}
		}
		return { h: Math.round(h * 360), s, l };
	}

	static hslToHex(h, s, l) {
		h = ((h % 360) + 360) % 360;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs((h / 60) % 2 - 1));
		const m = l - c / 2;
		let r, g, b;
		if (h < 60)       { r = c; g = x; b = 0; }
		else if (h < 120) { r = x; g = c; b = 0; }
		else if (h < 180) { r = 0; g = c; b = x; }
		else if (h < 240) { r = 0; g = x; b = c; }
		else if (h < 300) { r = x; g = 0; b = c; }
		else              { r = c; g = 0; b = x; }
		const toHex = (v) => {
			const hex = Math.round((v + m) * 255).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};
		return '#' + toHex(r) + toHex(g) + toHex(b);
	}

	static wcagContrastRatio(hex1, hex2) {
		const luminance = (hex) => {
			const r = parseInt(hex.slice(1, 3), 16) / 255;
			const g = parseInt(hex.slice(3, 5), 16) / 255;
			const b = parseInt(hex.slice(5, 7), 16) / 255;
			const linearize = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
			return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
		};
		const l1 = luminance(hex1);
		const l2 = luminance(hex2);
		const lighter = Math.max(l1, l2);
		const darker = Math.min(l1, l2);
		return (lighter + 0.05) / (darker + 0.05);
	}

	static randomColor() {
		const FOREGROUND_PALETTE = [
			'#FFFFFF', '#FFFDD0', '#E0E0E0', '#FFD700', '#1A1A2E', '#000000'
		];

		const h = Math.random() * 360;
		const s = 0.50 + Math.random() * 0.35;
		const l = 0.30 + Math.random() * 0.35;
		const background = this.hslToHex(h, s, l);

		// Textures and blend modes darken the effective background significantly,
		// so compute contrast against a darkened version to favor lighter foregrounds.
		const effectiveBg = this.hslToHex(h, s, Math.max(0, l - 0.25));

		let bestForeground = FOREGROUND_PALETTE[0];
		let bestContrast = 0;
		for (const candidate of FOREGROUND_PALETTE) {
			const ratio = this.wcagContrastRatio(effectiveBg, candidate);
			if (ratio > bestContrast) {
				bestContrast = ratio;
				bestForeground = candidate;
			}
		}

		const isDarkForeground = bestForeground === '#000000' || bestForeground === '#1A1A2E';
		let outline;
		if (isDarkForeground) {
			outline = '#FFFFFF';
		} else {
			const outlineL = l > 0.45 ? Math.max(0, l - 0.20) : Math.min(1, l + 0.20);
			outline = this.hslToHex(h, s, outlineL);
		}

		return { background, foreground: bestForeground, outline };
	}
	
	static initColorSets(entries = null) {
		let sets;
		if(entries)
		{
			let uniqueSet = {};
			uniqueSet[entries.name] = entries;
			sets = Object.entries(uniqueSet);
		}
		else
			sets = Object.entries(COLORSETS);
		for (const [name, data] of sets) {
			COLORSETS[name].id = name;
			if(data.texture != "custom")
				COLORSETS[name].texture = this.getTexture(data.texture);
			/*if(typeof COLORSETS[name].texture == "object")
				COLORSETS[name].texture.id = data.texture;*/
			if(typeof COLORSETS[name].texture == "object")
				COLORSETS[name].texture.id = data.id;
			if(!COLORSETS[name].material)
				COLORSETS[name].material = '';
			if(!COLORSETS[name].font)
				COLORSETS[name].font = 'Arial';
			if(!COLORSETS[name].fontScale)
				COLORSETS[name].fontScale = DICE_SCALE;
			else
				COLORSETS[name].fontScale = foundry.utils.mergeObject(DICE_SCALE,COLORSETS[name].fontScale,{inplace:false,applyOperators:true});
			if(!COLORSETS[name].visibility)
				COLORSETS[name].visibility = "visible";
		}
		
		// generate the colors, textures, and materials for the random set
		if(!entries)
		{
			const RANDOM_MATERIALS = ['plastic', 'metal', 'wood', 'glass', 'chrome', 'pristine', 'iridescent', 'stone', 'resin', 'frosted', 'velvet'];
			for (let i = 0; i < 10; i++) {
				let randcolor = this.randomColor();
				let randtex = this.getTexture('random');

				COLORSETS['random'].foreground.push(randcolor.foreground);
				COLORSETS['random'].background.push(randcolor.background);
				COLORSETS['random'].outline.push(randcolor.outline);
				COLORSETS['random'].texture.push(randtex.name != '' ? randtex : '');
				COLORSETS['random'].material.push(RANDOM_MATERIALS[Math.floor(Math.random() * RANDOM_MATERIALS.length)]);
			}
		}
	}
	
	static getColorSet(colorsetname) {
		let colorset = COLORSETS[colorsetname] || COLORSETS['custom'];
		return {...colorset};
	}

	static setColorCustom(foreground = '#FFFFFF', background = '#000000', outline = '#FFFFFF', edge = '#FFFFFF'){
		COLORSETS['custom'].foreground = foreground;
		COLORSETS['custom'].background = background;
		COLORSETS['custom'].outline = outline;
		COLORSETS['custom'].edge = edge;
	}
}
