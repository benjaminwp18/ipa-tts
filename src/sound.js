class Vowel {
	constructor(ipa, formants) {
		this.ipa = ipa;
		this.f1 = formants[0];
		this.f2 = formants[1];
	}

	play(ctx, duration) {
		let osc1 = ctx.createOscillator();
		let osc2 = ctx.createOscillator();
		osc1.type = "sine";
		osc2.type = "sine";
		osc1.frequency.value = this.f1;
		osc2.frequency.value = this.f2;
		osc1.connect(ctx.destination);
		osc2.connect(ctx.destination);
		osc1.start();
		osc2.start();
		osc1.stop(ctx.currentTime + 1);
		osc2.stop(ctx.currentTime + 1);
	}
}

export const VOWELS = new Map([
	// as per table on https://en.wikipedia.org/wiki/Formant
	["i", new Vowel("i", [240, 2400])],
	["y", new Vowel("y", [235, 2100])],
	["e", new Vowel("e", [390, 2300])],
	["ø", new Vowel("ø", [370, 1900])],
	["ɛ", new Vowel("ɛ", [610, 1900])],
	["œ", new Vowel("œ", [585, 1710])],
	["a", new Vowel("a", [850, 1610])],
	["ɶ", new Vowel("ɶ", [820, 1530])],
	["ɑ", new Vowel("ɑ", [750, 940])],
	["ɒ", new Vowel("ɒ", [700, 760])],
	["ʌ", new Vowel("ʌ", [600, 1170])],
	["ɔ", new Vowel("ɔ", [500, 700])],
	["ɤ", new Vowel("ɤ", [460, 1310])],
	["o", new Vowel("o", [360, 640])],
	["ɯ", new Vowel("ɯ", [300, 1390])],
	["u", new Vowel("u", [250, 595])],
]);
